const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
    },
    lastName: {
        type: String,
    },
    emaiId: {
        type: String,
    }, 
    password: {
        type: String,
    },
    age: {
        type: Number,
    },
})

const User = mongoose.model("User", userSchema);

module.exports = User;