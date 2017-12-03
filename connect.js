let ssh2 = require("ssh2"),
    fs = require("fs"),
    os = require("os");

const SSH_DIR = `${os.homedir()}/.nimus/ssh`;
const ssh = new ssh2.Client();

const connectData = {
    host: "104.197.13.184",
    username: 'nimus',
    port: 22,
    privateKey: fs.readFileSync(`${SSH_DIR}/nimus`, "utf-8")
};

console.log("@@@@ connectData", connectData);

ssh.on('ready', () => {
    console.log('@@@@ Client :: ready');

    ssh.exec('uptime', (error, stream) => {
        console.log('@@@@ Client :: exec :: result', error);

        if (error) {
            return console.log("update ssh command error");
        }

        stream.on('close', (code, signal) => {
            console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
            ssh.end();
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        });
    });
}).connect(connectData)