from functools import wraps
import uuid

from flask import Flask, session, render_template, request, g
from flask.ext.redis import FlaskRedis
from redis import StrictRedis

app = Flask(__name__)
app.secret_key = "n0tv3rys3cr3t"
r = FlaskRedis.from_custom_provider(StrictRedis, app)

# -------- REDIS METHODS -------- #

def token_key(token):
    return "token:{0}".format(token)

def create_new_token(username):
    token = str(uuid.uuid4())
    pipe = r.pipeline()
    rkey = token_key(token)
    pipe.set(rkey, username)
    pipe.expire(rkey, 10)
    pipe.execute()
    return token

def ping_token(token):
    rkey = token_key(token)
    username = r.get(rkey)
    if username:
        r.expire(rkey, 10)
    return username

def user_active(token):
    return r.get(token_key(token))


# -------- DECORATORS -------- #

def check_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        username = ping_token(session["token"])
        if username:
            g.username = username
            return f(*args, **kwargs)
        else:
            return '''{"error": "not logged in"}'''
    return decorated_function


# -------- ROUTES -------- #

@app.route("/")
def hello():
    return render_template("index.html")

@app.route("/token")
def get_token():
    username = request.args.get("username", None)
    if username:
        # Create a token for the user
        token = create_new_token(username)
        session["token"] = token
        return token
    else:
        return '''{"error": "specify username"}'''

@app.route("/status")
@check_auth
def ping():
    if g.get("username", None):
        return "username is {0}".format(g.get("username"))
    else:
        return "not logged in"


# -------- START APP -------- #

if __name__ == "__main__":
    app.run()