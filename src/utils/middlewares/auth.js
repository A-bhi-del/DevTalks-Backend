const adminAuth = (req, res, next) => {
    console.log("Admin authentication middleware is running");
    const token = "xyz"

    const isauthenticated = token === "xyz";
    if(!isauthenticated){
        res.status(401).send("Unauthorized access");
    } else {
        next();
    }
};

const userAuth = (req, res, next) => {
    console.log("Admin authentication middleware is running");
    const token = "xyzs"

    const isauthenticated = token === "xyz";
    if(!isauthenticated){
        res.status(401).send("Unauthorized access");
    } else {
        next();
    }
};
module.exports = { adminAuth, userAuth };