docker build --no-cache -t evergreen-app .
docker run -it --rm evergreen-app

docker save -o evergreen-app.tar evergreenapp