require("dotenv").config();
const express = require("express");
const app = express();
const redis = require("./ioredis");
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const helmet = require("helmet");
const cors = require("cors");

const PORT = process.env.PORT || 9091;

io.on("connect", (socket) => {
  console.log(`new client ==> ${socket.id}`);

  // Emit a test message
  socket.emit("message", "WebSocket server is working!");

  socket.on("message", (data) => {
      console.log("Received from client:", data);
  });
});


const vhost = (hostname) => (req, res, next) => {
  const host = req.headers.host.split(":")[0];
  if (host == hostname) {
    next();
  } else {
    return res.status(401).send("Invalid host");
  }
};

// client which connected to server with websocket
var clients = [];

const allowList = ["http://localhost"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowList.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), { origin: false });
      }
      return callback(null, { origin: true });
    },
    credentials: true,
  })
);
app.use(express.json());
app.disable("x-powered-by");
// app.use(vhost("localhost"))

app.use(helmet());
app.use(helmet.hidePoweredBy());
app.use(helmet({ crossOriginOpenerPolicy: true }));
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "script-src": ["'self'", "securecoding.com"],
      "style-src": null,
    },
  })
);
// app.use(helmet.expectCt({maxAge: 96400, enforce: true, reportUri:"https://google.com",}));
app.use(helmet.dnsPrefetchControl({ allow: true }));
app.use(helmet.frameguard({ action: "deny" }));
app.use(helmet.hsts({ maxAge: 123456, includeSubDomains: false }));
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.referrerPolicy({ policy: ["origin", "unsafe-url"] }));
app.use(helmet.xssFilter());

const start = async () => {
  server.listen(PORT, () => console.log("server listening on port " + PORT));


  app.use(function (req, res, next) {
    req.io = io;
    next();
  });

  io.on("connect", onConnect);

  async function onConnect(socket) {
    console.log(`New client connected: ${socket.id}`);

    socket.emit("");

    socket.on("otpsender", async (data) => {
      console.log("new otp sender:", data);
    });

    socket.on("message", (data) => {
      console.log(data);
    });

    ///// kogda sms optravleno
    socket.on("sended", async (data) => {
      console.log("sended chanel>>> ", socket.id);
      const index = clients.findIndex((x) => x.id === socket.id);
      clients[index].busy = false;
    });

    //// on disconnect
    socket.on("disconnect", async function () {
      console.log("disconnect ==> " + socket.id);
      var arr = clients.filter((c) => c.id !== socket.id);
      clients = arr;
      clients = clients.filter((c) => c.id !== socket.id);
    });
  }
};

start();

// SEND OPT PASSWORD //
app.post("/send", async function (req, res) {
  try {
    console.log("..................otp route");
    const random = Math.random().toFixed(5).substr(`-${5}`);
    const _phone = req.body.phone;
    if (!_phone || !/^[6][1-5][0-9]{6}$/g.test(_phone)) {
      return res.status(400).json({ message: "Bad request" });
    }

    req.io.emit("send", {
      phone_number: `+993${_phone}`,
      pass: `Siziň aktiwasiýa koduňyz ${random}`,
    });
    console.log("...............ok");

    await redis.setex(_phone, 600, random);
    return res.json({
      success: true,
      message: "otp pass send and save",
      phone_number: `+993${_phone}`,
      pass: `Siziň aktiwasiýa koduňyz ${random}`,
    });
  } catch (e) {
    // console.log("sadfbasjfbhj")
    return res.status(400).json({ message: e.message });
  }
});

// COMPARE OTP PASSWORD //
app.post("/compare", async function (req, res) {
  try {
    const _phone = req.body.phone_number;
    const _otp = req.body.pass;
    const cacheData = await redis.get(_phone);
    if (!_phone || !/^[6][1-5][0-9]{6}$/g.test(_phone)) {
      return res.status(400).json({ message: "Bad request" });
    }

    if (String(_otp) === String(cacheData)) {
      redis.del(_phone);
      console.log("success");
      return res.json({ success: true });
    }
    console.log("unsuccess");
    return res.status(403).json({ success: false });
  } catch (e) {
    return res.status(403).json({ message: e.message });
  }
});

// SEND CUSTOM SMS
app.post("/send-sms", async function (req, res) {
  try {
    let _phone = req.body.phone_number;
    let _message = req.body.message;
    if (!_phone || !/^(\+993)?6[1-5]\d{6}/g.test(_phone)) {
      return res.status(400).json({ message: "Bad request" });
    }
    if (_phone.includes("+993")) _phone = _phone.slice(4);

    req.io.emit("otp", { phone: `+993${_phone}`, pass: _message });
    console.log("...............ok");

    return res.json({
      success: true,
      message: "message send",
      phone_number: `+993${_phone}`,
      pass: _message,
    });
  } catch (e) {
    // console.log("sadfbasjfbhj")
    return res.status(400).json({ message: e.message });
  }
});
