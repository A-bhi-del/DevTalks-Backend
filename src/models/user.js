const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
    },

    lastName: {
        type: String,
    },

    emailId: {
        type: String,
        required: true,
        unique: true,
        trim: true,

        validate(value) {
            if (!validator.isEmail(value)) {
                throw new Error("invalid email");
            }
        }
    },

    password: {
        type: String,
        required: true,
        minLength: 8,
        select: false, 
        validate(value) {
            if (!validator.isStrongPassword(value)) {
                throw new Error("Password must be strong");
            }
        }
    },

    age: {
        type: Number,
        min: 18,
        max: 70,
        validate(value) {
            if (value < 18) {
                throw new Error("Age must be greater than 18");
            }
        }
    },

    gender: {
        type: String,
        validate(value) {
            if(!["male", "female", "other"].includes(value)){
                throw new Error("Invalid gender");
            }
        }
    },

    photoUrl: {
        type: String,
        default: "https://example.com/default-profile.png",
        validate(value) {
            if (!validator.isURL(value)) {
                throw new Error("Invalid URL for photo");
            }
        }
    },

    about: {
        type: String,
        default: "Hello, i am user of DevTinder",
    },

    skills: {
        type: [String],
    },

    isOnline : { 
        type : Boolean,
        default : false,
    },

    lastSeen : { 
        type : Date,
        default : null,
    }

},

    {
        timestamps: true, 
    })

userSchema.methods.getJWT = async function () {
    const user = this;
    const token = await jwt.sign({ _id: user._id }, "sgvd@2873b", { expiresIn: "10d" });
    return token;
}

userSchema.methods.validatePassword = async function (passwordInputByuser) {
    const user = this;
    const passwordhash = user.password;
    const validPassword = await bcrypt.compare(passwordInputByuser, passwordhash);
    return validPassword;
}
const User = mongoose.model("User", userSchema);

module.exports = User;