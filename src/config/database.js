const mongoose = require('mongoose');

const connectDB = async () => {
    await mongoose.connect("mongodb+srv://guptaabhishek60420:83uiMes4tZZeJc%23@abhimongo.ls4peto.mongodb.net/devTinder");
};

module.exports = connectDB;