const async = require("async");

const CMessage = require("./Message.js");
const CConstants = require("./Constants.js");
const CMessageContainer = require("./MessageContainer.js");
const CDirection = require("./Direction.js");

class Robot {
    constructor(socket) {
        this.socket = socket;

        this.messagesContainer = new CMessageContainer.MessageContainer(this.socket);
        this.socket.on("data", (data) => {
            this.messagesContainer.storeMessage(false, data.toString());
        });

        this.serverHash = 0;
        this.clientHash = 0;

        this.x = null;
        this.y = null;

        this.desiredX = 2;
        this.desiredY = -2;

        this.currentDirection = "";
        this.desiredXDirection = "";
        this.desiredYDirection = "";

        this.name = "";

        this.positionChange = false;
    }

    // HASH HELPER
    computeHash() {
        for (let i = 0; i < (this.name.length - CConstants.SUFFIX.length); i++) {
            this.serverHash += this.name[i].charCodeAt();
        }

        this.serverHash = (this.serverHash * 1000) % 65536;

        this.clientHash = (this.serverHash + CConstants.CLIENT_KEY) % 65536;
        this.serverHash = (this.serverHash + CConstants.SERVER_KEY) % 65536;

        console.log("Hashes: ", this.clientHash, this.serverHash);
    }

    // DIRECTION HELPERS
    getCurrentDirection(rozdielSuradnic) {
        if (rozdielSuradnic.x == 0 && rozdielSuradnic.y == 1) {
            this.currentDirection = CDirection.DirectionEnums.UP;
        } else if (rozdielSuradnic.x == 0 && rozdielSuradnic.y == -1) {
            this.currentDirection = CDirection.DirectionEnums.DOWN;
        } else if (rozdielSuradnic.x == 1 && rozdielSuradnic.y == 0) {
            this.currentDirection = CDirection.DirectionEnums.RIGHT;
        } else {
            this.currentDirection = CDirection.DirectionEnums.LEFT;
        }

        console.log("CURRENT DIRECTION: ", this.currentDirection, rozdielSuradnic);
    }

    // ROTATION/MOVE HELPERS
    rotateRight(inside, callback) {
        this.socket.write(CConstants.SERVER_TURN_RIGHT);

        this.messagesContainer.maxMessageLength = CConstants.CLIENT_OK_MESSAGE_LENGTH;

        this.messagesContainer.setCallback((clientMessage) => {

            const validMessage = CMessage.Message.validate(clientMessage, "CLIENT_OK");

            if (!validMessage) {
                return CMessage.Message.sendSyntaxErrorMessage(this.socket);
            }

            this.currentDirection = this.currentDirection + 1;
            if (this.currentDirection == 5) {
                this.currentDirection = 1;
            }

            if (!inside) {
                callback();
            } else {
                this.pickUpMessage(() => {
                    callback();
                });
            }
        });
    }

    move(inside, callback) {
        this.socket.write(CConstants.SERVER_MOVE);

        this.messagesContainer.maxMessageLength = CConstants.CLIENT_OK_MESSAGE_LENGTH;

        this.messagesContainer.setCallback((clientMessage) => {

            const validMessage = CMessage.Message.validate(clientMessage, "CLIENT_OK");

            if (!validMessage) {
                return CMessage.Message.sendSyntaxErrorMessage(this.socket);
            }

            this.x = validMessage[1];
            this.y = validMessage[2];

            console.log("NEW POSITION: ", this.x, " ", this.y);

            if (inside) {
                this.pickUpMessage(() => {
                    callback();
                });
            } else {
                callback();
            }
        });
    }

    // -------- MAIN METHODS --------

    authenticate(callback) {
        console.log("Authentication..");

        this.messagesContainer.maxMessageLength = CConstants.CLIENT_USERNAME_MESSAGE_LENGTH;

        this.messagesContainer.setCallback((celeMeno) => {

            this.name = celeMeno;

            console.log("MENO:", celeMeno);
            const validMessage = CMessage.Message.validate(this.name, "CLIENT_USERNAME");

            if (!validMessage) {
                return CMessage.Message.sendSyntaxErrorMessage(this.socket);
            }

            this.computeHash();

            this.socket.write(`${this.serverHash}${CConstants.SUFFIX}`);

            callback();
        });
    }

    getHashMessageFromClient(callback) {
        console.log("getHashMessageFromClient...");

        this.messagesContainer.maxMessageLength = CConstants.CLIENT_CONFIRMATION_MESSAGE_LENGTH;

        this.messagesContainer.setCallback((hashFromClient) => {

            const validMessage = CMessage.Message.validate(hashFromClient, "CLIENT_CONFIRMATION");

            if (!validMessage) {
                return CMessage.Message.sendSyntaxErrorMessage(this.socket);
            }

            if (hashFromClient.split(CConstants.SUFFIX) && hashFromClient.split(CConstants.SUFFIX)[0]) {
                hashFromClient = hashFromClient.split(CConstants.SUFFIX)[0];
            } else {
                console.log("HASH FROM CLIENT NOT FOUND");
            }
            const hashLengthBeforeParse = hashFromClient.length;

            hashFromClient = parseInt(hashFromClient);
            const hashLengthAfterParse = (hashFromClient + "").length;

            if (hashLengthAfterParse !== hashLengthBeforeParse) {
                console.log(hashLengthAfterParse, hashLengthBeforeParse);
                return CMessage.Message.sendSyntaxErrorMessage(this.socket);
            }

            if (hashFromClient !== this.clientHash) {
                console.log("BAD HASH from client!");
                this.socket.write(CConstants.SERVER_LOGIN_FAILED);
                this.socket.end();
                return;
            }

            this.socket.write(CConstants.SERVER_OK);

            callback();
        });
    }

    // GETPOSITION HELPER
    _getPosition(callback) {

        this.messagesContainer.maxMessageLength = CConstants.CLIENT_OK_MESSAGE_LENGTH;

        this.messagesContainer.setCallback((messageFromClient) => {

            const validMessage = CMessage.Message.validate(messageFromClient, "CLIENT_OK");

            console.log("VALID?: ", messageFromClient, validMessage);

            if (!validMessage) {
                return CMessage.Message.sendSyntaxErrorMessage(this.socket);
            }

            if (!this.x && !this.y) {
                this.x = validMessage[1];
                this.y = validMessage[2];

                this.socket.write(CConstants.SERVER_MOVE);
            } else {
                const rozdielSuradnic = {};

                rozdielSuradnic.x = validMessage[1] - this.x;
                rozdielSuradnic.y = validMessage[2] - this.y;

                this.x = validMessage[1];
                this.y = validMessage[2];

                if (rozdielSuradnic.x == 0 && rozdielSuradnic.y == 0) {
                    this.socket.write(CConstants.SERVER_MOVE);
                } else {
                    this.positionChange = true;
                    console.log("POSITION CHANGE");
                    this.getCurrentDirection(rozdielSuradnic);
                }
            }

            callback();
        });
    }

    getPosition(callback) {
        console.log("getPosition()...");

        this.socket.write(CConstants.SERVER_MOVE);

        const _this = this;

        async.until(() => {
            return _this.positionChange == true;
        }, function (callback) {
            _this._getPosition(callback);
        }, () => {
            console.log("Direction is: ", _this.currentDirection);
            callback();
        });
    }

    computeDirectionToEdgePoint(callback) {
        console.log("computeDirectionToEdgePoint()...");
        if (this.x < this.desiredX) {
            this.desiredXDirection = CDirection.DirectionEnums.RIGHT;
        } else if (this.x > this.desiredX) {
            this.desiredXDirection = CDirection.DirectionEnums.LEFT;
        } else {
            this.desiredXDirection = true;
        }

        if (this.y < this.desiredY) {
            this.desiredYDirection = CDirection.DirectionEnums.UP;
        } else if (this.y > this.desiredY) {
            this.desiredYDirection = CDirection.DirectionEnums.DOWN;
        } else {
            this.desiredYDirection = true;
        }

        console.log("POZICIE:", this.x + " " + this.y + " " + this.desiredXDirection + " " + this.desiredYDirection);

        callback();
    }

    // Navigate to Edge point
    navigateToEdgePoint(inside, callback) {
        console.log("navigateToEdgePoint");

        const _this = this;

        // Musíme nastaviť dobrý smer k bodu X
        async.until(() => {
            console.log(_this.currentDirection == _this.desiredXDirection, _this.currentDirection, _this.desiredXDirection);
            return _this.currentDirection == _this.desiredXDirection;
        }, function (callback) {
            _this.rotateRight(inside, callback);
        }, () => {
            // Smer nastavený správne, posúvame sa po políčkach

            async.whilst(() => {
                return _this.x != _this.desiredX;
            }, function (callback) {
                _this.move(inside, callback);
            }, () => {
                // Sme na danom bode X, nastavíme pozíciu pre smer Y
                async.until(() => {
                    return _this.currentDirection == _this.desiredYDirection;
                }, function (callback) {
                    _this.rotateRight(inside, callback);
                }, () => {

                    // Smer nastavený správnr, posúvame sa po políčkach
                    async.whilst(() => {
                        return _this.y != _this.desiredY;
                    }, function (callback) {
                        _this.move(inside, callback);
                    }, () => {
                        callback();
                    });
                });
            });
        });
    }

    // 18 faili, lebo nie je mesidz ukonceny \a\b
    pickUpMessage(callback) {
        console.log("pickUpMessage()...");
        this.messagesContainer.maxMessageLength = CConstants.CLIENT_MESSAGE_MESSAGE_LENGTH;

        this.socket.write(CConstants.SERVER_PICK_UP);

        this.messagesContainer.setCallback((pickedUpMessage) => {

            const validMessage = CMessage.Message.validate(pickedUpMessage, "CLIENT_MESSAGE");
            console.log("JE VALID: ", validMessage);

            if (!validMessage) {
                return CMessage.Message.sendSyntaxErrorMessage(this.socket);
            }

            if (pickedUpMessage === CConstants.SUFFIX) {
                callback();
            } else {
                this.socket.write(CConstants.SERVER_LOGOUT);
                this.socket.end();
            }
        });
    }

    goThroughArrayAndPickUpMessages(callback) {
        console.log("goThroughArrayAndPickUpMessages()...");

        const points = [[-2, -2], [-2, -1], [2, -1], [2, 0], [-2, 0], [-2, 1], [2, 1], [2, 2], [-2, 2]];

        async.timesSeries(points.length, (n, next) => {
            this.desiredX = points[n][0];
            this.desiredY = points[n][1];
            this.computeDirectionToEdgePoint(() => {
                this.navigateToEdgePoint(true, () => {
                    next();
                });
            });
        }, () => {
            callback();
        });
    }

    main() {

        this.authenticate(() => {
            this.getHashMessageFromClient(() => {
                this.getPosition(() => {
                    this.computeDirectionToEdgePoint(() => {
                        this.navigateToEdgePoint(false, () => {
                            console.log("Sme na bode | 2 -2 |!");
                            this.goThroughArrayAndPickUpMessages();
                        });
                    });
                });
            });
        });
    }
}

exports.Robot = Robot;