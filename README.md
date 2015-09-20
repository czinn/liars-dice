# Liar's Dice

This implementation of Liar's Dice uses a Mental Poker protocol to guarantee that all clients are playing by the rules. This enables the clients to police each other: you can be sure your opponent is playing fairly, even if you don't trust them or the server. The server simply manages the connection between players.

Theoretically, the game could be played without a server at all, provided the clients had some other way of communicating. However, I was unable to find a suitable open P2P chat client, so I was forced to write a server as well. I was able to delegate matchmaking to the server, and this significantly relaxed the requirements of the commitment schema without sacrificing the verifiable fairness of the game.

# The Commitment Schema

The commitment schema (or protocol) goes something like this (with `Hash(x)` being some hash function; SHA-512 is used in this implementation):

1. Each player picks a secret number `K` and computes `C = Hash(K)` and `D = Hash(C)`
2. Each player reveals `D` to all other players.
3. Each player reveals `C` to all other players, who can verify that `D = Hash(C)`. This ensures that players didn't change their `C` in response to other players revealing their values.
4. All revealed `C`s are added together in some commutative way to get `S`.
5. Each player calculates `Hash(C + S)` (all players can do this for all other players) to obtain the turn ordering for the round (lowest to highest).
6. Each player privately calculates `R = Hash(K + S)`. `R` is the player's private value; in Liar's Dice, it's used to generate their set of dice.
7. After the round, each player reveals `K` and `R`, and other players can verify that this matches their commitment `C`.
