const CConstants = require("./Constants.js");

class Message {
    static sendSyntaxErrorMessage(socket) {
        socket.write(CConstants.SERVER_SYNTAX_ERROR);
        socket.end();
    }

    static validate(message, messageType) {

        if (messageType === "CLIENT_USERNAME") {

            if (message.length > CConstants.CLIENT_USERNAME_MESSAGE_LENGTH) {
                return false;
            }

            if (message.indexOf(CConstants.SUFFIX) != (message.length - CConstants.SUFFIX_LENGTH)) {
                return false;
            }

            return true;
        } else if (messageType === "CLIENT_CONFIRMATION") {

            if (message.length > CConstants.CLIENT_CONFIRMATION_MESSAGE_LENGTH) {
                return false;
            }

            if (message.indexOf(CConstants.SUFFIX) != (message.length - CConstants.SUFFIX_LENGTH)) {
                return false;
            }

            const messageWithoutSuffix = message.split(CConstants.SUFFIX) && message.split(CConstants.SUFFIX)[0];

            if (isNaN(messageWithoutSuffix) || !messageWithoutSuffix) {
                return false;
            }

            return true;
        } else if (messageType === "CLIENT_OK") {
            if (message.length > CConstants.CLIENT_OK_MESSAGE_LENGTH) {
                return false;
            }

            if (message.indexOf(CConstants.SUFFIX) != (message.length - CConstants.SUFFIX_LENGTH)) {
                return false;
            }

            const messageWithoutSuffix = message.split(CConstants.SUFFIX) && message.split(CConstants.SUFFIX)[0];

            if (!messageWithoutSuffix) {
                return false;
            }

            const partsOfTheMessage = messageWithoutSuffix.split(" ");

            if (partsOfTheMessage.length !== 3 || partsOfTheMessage[0] !== "OK") {
                return false;
            }

            const firstNumber = parseFloat(partsOfTheMessage[1]);
            const secondNumber = parseFloat(partsOfTheMessage[2]);

            if (!Number.isInteger(firstNumber) || !Number.isInteger(secondNumber)) {
                return false;
            }

            return partsOfTheMessage;
        } else if (messageType === "CLIENT_RECHARGING") {

            return message === `RECHARGING${CConstants.SUFFIX}`;
        } else if (messageType === "CLIENT_FULL_POWER") {

            return message === `FULL POWER${CConstants.SUFFIX}`;
        } else if (messageType === "CLIENT_MESSAGE") {

            if (message === CConstants.SUFFIX) {
                return true;
            }

            if (message.length > CConstants.CLIENT_MESSAGE_MESSAGE_LENGTH) {
                return false;
            }

            if (message.indexOf(CConstants.SUFFIX) != (message.length - CConstants.SUFFIX_LENGTH)) {
                return false;
            }

            const messageWithoutSuffix = message.split(CConstants.SUFFIX) && message.split(CConstants.SUFFIX)[0];

            if (!messageWithoutSuffix) {
                return false;
            }

            if (messageWithoutSuffix[0].indexOf(CConstants.SUFFIX) != -1) {
                return false;
            }

            return true;
        } else {
            return false;
        }
    }
}

exports.Message = Message;
