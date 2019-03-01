const CConstants = require("./Constants.js");
const CMessage = require("./Message.js");

class MessageContainer {
    constructor(socket) {
        this.buffer = [];
        this.message = "";
        this.callback = null;
        this.maxMessageLength = 0;
        this.rechargingTimeout = null;
        this.recharging = false;
        this.socket = socket;
        this.timeout = null;
        this.id = 0;
    }

    createTimeout() {
        this.timeout = setTimeout(() => {
            if (!this.recharging) {
                this.socket.end();
                console.log("TIMEOUT");
            }
        }, CConstants.TIMEOUT);
        console.log("CREATING TIMEOUT");
    }

    deleteTimeout() {
        console.log("CLEARING TIMEOUT");
        clearTimeout(this.timeout);
    }

    createRechargeTimeout() {
        this.rechargingTimeout = setTimeout(() => {
            console.log("RECHARGE TIMEOUT");
            this.socket.end();
        }, CConstants.TIMEOUT_RECHARGING);
    }

    deleteRechargeTimeout() {
        clearTimeout(this.rechargingTimeout);
    }

    storeMessage(run, message) {
        this.deleteTimeout();

        if (!run) {
            let lastStoredMessage = this.buffer[this.buffer.length - 1];

            let newMessage = "";
            for (let i = 0; i < message.length; i++) {
                newMessage += message[i];

                if (lastStoredMessage) {
                    if (lastStoredMessage.endsWith(CConstants.SUFFIX)) {
                        // máme prvok v poli, ktorý je zakončený \a\b
                        if (newMessage.endsWith((CConstants.SUFFIX))) {
                            this.buffer.push(newMessage);
                            newMessage = "";
                            lastStoredMessage = this.buffer[this.buffer.length - 1];
                        }
                    } else {
                        // máme prvok v poli, ktorý nie je zakončený \a\b
                        if ((lastStoredMessage + newMessage).endsWith(CConstants.SUFFIX)) {
                            lastStoredMessage += newMessage;
                            this.buffer.pop();
                            this.buffer.push(lastStoredMessage);
                            newMessage = "";
                            lastStoredMessage = this.buffer[this.buffer.length - 1];
                        }
                    }
                } else {
                    // nemáme prvok v poli
                    if (newMessage.endsWith(CConstants.SUFFIX)) {
                        this.buffer.push(newMessage);
                        newMessage = "";
                        lastStoredMessage = this.buffer[this.buffer.length - 1];
                    }
                }
            }

            if (newMessage) {
                if (lastStoredMessage) {
                    if (lastStoredMessage.endsWith(CConstants.SUFFIX)) {
                        // máme prvok v poli, ktorý je zakončený \a\b
                        this.buffer.push(newMessage);
                        newMessage = "";
                        lastStoredMessage = this.buffer[this.buffer.length - 1];
                    } else {
                        // máme prvok v poli, ktorý nie je zakončený \a\b
                        console.log("pridavame do noveho: ", lastStoredMessage);
                        lastStoredMessage += newMessage;
                        this.buffer.pop();
                        this.buffer.push(lastStoredMessage);
                        console.log("pridane: ", lastStoredMessage, this.buffer[this.buffer.length - 1]);
                        newMessage = "";
                        lastStoredMessage = this.buffer[this.buffer.length - 1];
                    }
                } else {
                    // nemáme prvok v poli
                    this.buffer.push(newMessage);
                    newMessage = "";
                    lastStoredMessage = this.buffer[this.buffer.length - 1];
                }
            }
        }

        console.log("STORE MESSAGE BUFFER: ", this.buffer);

        this.message = this.buffer[0];

        if (this.message.endsWith(CConstants.SUFFIX)) {

            const rechargingMessage = CMessage.Message.validate(this.message, "CLIENT_RECHARGING");

            if (rechargingMessage) {
                // Dostali sme druhy raz po sebe CLIENT_RECHARING
                if (this.recharging) {
                    this.socket.write(CConstants.SERVER_LOGIC_ERROR);
                    this.socket.end();
                    return;
                }
                // Vytvor timeout
                this.createRechargeTimeout();
                this.recharging = true;
                this.buffer.shift();
                this.message = "";
                return;
            }

            if (this.recharging) {
                // Robot sa nabíjal, check či táto správa === CLIENT_FULL_POWER
                const fullPowerMessage = CMessage.Message.validate(this.message, "CLIENT_FULL_POWER");

                if (!fullPowerMessage) {
                    console.log("SERVER LOGIC ERROR");
                    this.socket.write(CConstants.SERVER_LOGIC_ERROR);
                    this.socket.end();
                    return;
                }

                this.deleteRechargeTimeout();
                this.recharging = false;
                this.buffer.shift();
                
                if (this.buffer[0]) {
                    this.storeMessage(true);
                }

                this.message = "";
                return;
            }

            this.buffer.shift();
            this.callback(this.message);
            this.message = "";
        } else {
            console.log("DLZKA: ", this.message.length, this.maxMessageLength);
            if (this.message.length >= this.maxMessageLength) {
                this.socket.write(CConstants.SERVER_SYNTAX_ERROR);
                this.socket.end();
                return;
            }
            this.createTimeout();
        }
    }

    retrieveMessage() {
        return this.message;
    }

    setCallback(callback) {
        this.callback = callback;
        this.createTimeout();
        if (this.buffer[0]) {
            this.storeMessage(true);
        }
    }
}

exports.MessageContainer = MessageContainer;