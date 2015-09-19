from functools import wraps
import uuid
import json

from flask import Flask, session, render_template, request, g
from flask.ext.redis import FlaskRedis
from redis import StrictRedis

app = Flask(__name__)
app.secret_key = "n0tv3rys3cr3t"
r = FlaskRedis.from_custom_provider(StrictRedis, app)

# -------- HACKY CONFIG -------- #

EXPIRE_SECONDS = 1000


# -------- REDIS METHODS -------- #

def token_key(token):
    return "token:{0}".format(token)

def updates_key(token):
    return "updates:{0}".format(token)

def update_id_key(token):
    return "update_key:{0}".format(token)

def create_new_token(username):
    token = str(uuid.uuid4())
    pipe = r.pipeline()
    rkey = token_key(token)
    pipe.set(rkey, username)
    pipe.expire(rkey, EXPIRE_SECONDS)
    pipe.sadd("active_users", token)
    pipe.execute()
    return token

def ping_token(token):
    rkey = token_key(token)
    username = r.get(rkey)
    if username:
        r.expire(rkey, EXPIRE_SECONDS)
    return username

def user_active(token):
    return r.get(token_key(token))

# Update is a dictionary
def push_update(token, update):
    if not user_active(token):
        return False
    rkey = updates_key(token)
    idkey = update_id_key(token)
    ident = r.incr(idkey)
    update["id"] = ident
    r.rpush(rkey, json.dumps(update))
    return True

# Gets updates after the given update
def get_updates(token, update_id=0):
    rkey = updates_key(token)
    idkey = update_id_key(token)

    pipe = r.pipeline()
    pipe.llen(rkey)
    pipe.get(idkey)
    results = pipe.execute()

    size = results[0]
    if size == 0: return []
    last_id = int(results[1])
    first_id = last_id - size + 1
    first_unseen_index = max(0, update_id - first_id + 1)

    pipe = r.pipeline()
    pipe.ltrim(rkey, first_unseen_index, -1)
    pipe.lrange(rkey, 0, -1)
    results = pipe.execute()

    return list(map(json.loads, (v.decode("utf-8") for v in results[1])))

def get_active_users():
    actives = r.smembers("active_users")
    rval = []
    pipe = r.pipeline()
    for token in actives:
        token = token.decode("utf-8")
        if user_active(token):
            rval.append(token)
        else:
            pipe.srem("active_users", token)
    pipe.execute()
    return rval


# -------- HELPER METHODS -------- #

def short_id(token):
    return token.split("-")[:1]


# -------- DECORATORS -------- #

def check_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        username = ping_token(session["token"])
        if username:
            g.token = session["token"] # easier access
            g.username = username.decode("utf-8")
            return f(*args, **kwargs)
        else:
            return json.dumps({"error": "bad auth"})
    return decorated_function


# -------- ROUTES -------- #

@app.route("/")
def hello():
    return render_template("index.html", token=session["token"] if "token" in session else None)

@app.route("/token")
def get_token():
    username = request.args.get("username", None)
    if username:
        # Create a token for the user
        token = create_new_token(username)
        session["token"] = token
        return json.dumps({"token": token, "username": username})
    else:
        return json.dumps({"error": "specify username"})

@app.route("/updates")
@check_auth
def updates():
    update_id = int(request.args.get("id", 0))
    return json.dumps({"updates": get_updates(g.token, update_id)})

@app.route("/username")
@check_auth
def username():
    return json.dumps({"username": g.username})

@app.route("/chat", methods=["POST"])
@check_auth
def chat():
    if not request.json["message"]:
        return json.dumps({"error": "no message"})

    update = {
        "type": "chat",
        "user_id": short_id(g.token),
        "username": g.username,
        "message": request.json["message"]
    }

    users = get_active_users()
    print(users)
    for user in users:
        push_update(user, update)

    return json.dumps({"success": 1})


# -------- START APP -------- #

if __name__ == "__main__":
    app.run()