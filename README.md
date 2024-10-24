# Introduce

Introducing a powerful slack bot designed to enhance communication and strengthen relationships among coworkers. With its advanced features, this bot revolutionizes workplace interactions, enabling seamless messaging and fostering a sense of camaraderie.

# Features

1. support emoji changed notification 🍿
2. support teammate join notification 🙌
3. support user delete notification 🥹
4. support user status changed notification 🔔
5. support channel archive notification 📣
6. support channel created notification 💪
7. support watch command 👀
8. support message command ✉️
9. support anonymous speaking 🙊

# License

[LICENSE](LICENSE)

docker build --platform linux/arm64 -t gengar-bark .
docker tag gengar-bark:latest sakiila/gengar-bark:latest
docker push sakiila/gengar-bark:latest
docker run -d --name gengar-bark -p 3001:3000 gengar-bark 

local
docker build --platform linux/arm64 -t gengar-bark:latest .
docker run -d --name gengar-bark -p 3001:3000 gengar-bark

