const express = require("express");

const app = express();
app.use("/user", (req, res, next) => {
  console.log("user 1 is running");
  // res.send("user 1 response");
  next();
}, 
(req, res, next) => {
  console.log("user 2 is running");
  // res.send("user 2 response");
  next();
}, 
(req, res, next) => {
  console.log("user 3 is running");
  // res.send("user 3 response");
  next();
}, 
(req, res, next) => {
  console.log("user 4 is running");
  // res.send("user 4 response");
  next();
}, 
(req, res, next) => {
  console.log("user 5 is running");
  // res.send("user 5 response");
  // next();
})

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});