FROM golang:1.23 AS build

WORKDIR /app

COPY . .

RUN ls -alh .
RUN GOWORK=off go build -o signersvc ./signer
RUN chmod +x signersvc

FROM ubuntu:24.04

WORKDIR /app
COPY --from=build /app/signersvc ./signersvc
#ENTRYPOINT ["/app/signersvc"]