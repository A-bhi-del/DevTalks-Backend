const express = require("express");

const app = express();
// app.use("/",(req, res) => {
//     res.send("Welcome to dashboard");
// })

app.use("/Hello",(req, res) => {
    res.send("Hello world")
})

app.use("/abhi", (req,res) => {
    res.send("Hello abhi");
})

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});