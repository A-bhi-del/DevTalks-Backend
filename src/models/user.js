const mongoose = require('mongoose');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required : true,
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
            if(!validator.isEmail(value)){
                throw new Error("invalid email");
            }
        }
    }, 
    password: {
        type: String,
        required: true,
        minLength: 8,
        select : false, // Exclude password from queries by default
        validate(value){
            if(!validator.isStrongPassword(value)){
                throw new Error("Password must be strong");
            }
        }
    },
    age: {
        type: Number,
        min: 18,
        validate(value) {
            if(value < 18){
                throw new Error("Age must be greater than 18");
            }
        }
    },
    gender: {
        type: String,
        // validate function always works for only when we create a new user it does not work for update , delete . if you want that is work for update and delete also than we should do enable the calidate
        // validate(value) {
        //     if(!["male", "female", "other"].includes(value)){
        //         throw new Error("Invalid gender");
        //     }
        // }
    },
    photoUrl: {
        type: String,
        default: "https://example.com/default-profile.png",
        validate(value){
            if(!validator.isURL(value)){
                throw new Error("Invalid URL for photo");
            }
        }
    },
    about: {
        type: String,
        default: "Hello, i am user of DevTinder",
    },
    skills: {
        type : [String],
    }
},
{
    timestamps: true, // Automatically adds createdAt and updatedAt fields
})

const User = mongoose.model("User", userSchema);

module.exports = User;