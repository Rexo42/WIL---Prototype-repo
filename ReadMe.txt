docker build --no-cache -t evergreen-app .
docker run -it --rm evergreen-app

docker save -o evergreen-app.tar evergreen-app
docker run -it --rm evergreen-app

COMMANDS TO SETUP:
docker run -it --rm evergreen-app
docker run -it --rm evergreen-app