FROM balenalib/raspberry-pi-debian:stretch

RUN  apt-get update && apt-get install -y build-essential curl g++

COPY build-ffmpeg /

ENV SKIPINSTALL=yes VERBOSE=yes

VOLUME /build
WORKDIR /build

CMD /build-ffmpeg --build