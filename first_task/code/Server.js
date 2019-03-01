const net = require("net");

const CRobot = require("./Robot.js");

class Server {
    run() {
        const server = net.createServer({}, socket => {
            const robot = new CRobot.Robot(socket);

            console.log("Connection has been established.");

            robot.main();
        });

        server.listen(1234, "127.0.0.1", () => {
            console.log("Server has been started up.");
        });
    }
}


// Spusti server
const app = new Server();
app.run();
