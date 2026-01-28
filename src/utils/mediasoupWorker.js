const mediasoup = require("mediasoup");
const { createWorker } = require("mediasoup");

 let worker;
 let rooms = {};

 const createWorkerFunc = async () => {
  try {
    worker = await createWorker({
      logLevel: "debug",
      rtcMinPort: 20000,
      rtcMaxPort: 21000
    });

    worker.on("died", () => {
      console.error("❌ Mediasoup worker died, exiting...");
      process.exit(1);
    });

    console.log("✅ Mediasoup Worker Created");
    console.log("Announce IP : ", process.env.ANNOUNCE_IP);
  } catch (error) {
    console.error("❌ Failed to create Mediasoup Worker:", error);
  }
};


const getWorker = () => worker;

module.exports = {
  getWorker,
  rooms,
  createWorkerFunc
};
