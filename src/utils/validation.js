const validator = require('validator');
const validateSignupData = (req) => {
  const {firstName, lastName, emailId, password} = req.body;
  if(!firstName || !lastName){
    throw new Error("First name and last name are not registered");
  } else if(!validator.isEmail(emailId)){
    throw new Error("Email is not valid");
  } else if(!validator.isStrongPassword(password)){
    throw new Error("Password is not strong");
  }
}


const validateProfileData = (req) => {
  const isAllowedFields = ["firstName", "lastName", "emailId", "age", "gender", "skills", "photoUrl", "about"];

  const validField = Object.keys(req.body).every((field) => isAllowedFields.includes(field));

  return validField;
}

module.exports = {validateSignupData, validateProfileData};