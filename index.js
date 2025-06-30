import express from "express";
import { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import session from "express-session";
import { parseArgs } from "util";
import { Strategy } from "passport-local";

const app = express();
const port = 3000;
const saltRounds = 10;

app.use(session({
    secret: "CONFIDENTIAL",
    resave: false,
    saveUninitialized: true,
}));

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "Keeper",
    password: "@Rajdeep2006", 
});
db.connect();

app.use(bodyParser.urlencoded({ extended : true}));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());

var notes = [];
var authenticated = true;
var isRegistered = false;
var firstTime = false;

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs", {isAuthenticated: authenticated});
});

app.get("/register", (req, res) => {
  res.render("register.ejs", {isRegistered: isRegistered});
});

app.get("/index", async (req, res) => {
    console.log(req.isAuthenticated());
    if (req.isAuthenticated()){
        authenticated = true;
        req.session.userid = req.user.userid;
        req.session.name = req.user.username;
        console.log(req.session.name);
        console.log("Authenticated");
        notes = await reloadDB(req.user.userid || req.query.userid);
        console.log(notes);
        res.render("index.ejs", {notes: notes, userid: req.session.userid, firstTime: firstTime, name: req.session.name});
    } else {
        console.log("Not authenticated");
        authenticated = false;
        res.redirect("/login");
    }
});

app.post("/login", passport.authenticate("local", {
    successRedirect: "/index",
    failureRedirect: "/login",
}));

app.post("/register", async (req, res) => {
    let username = req.body.name;
    let email = req.body.username;
    let password= req.body.password;
    
    try{
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email,]);

        if (checkResult.rows.length > 0){
            isRegistered = true;
            res.redirect("/register");
        } else {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.error("Error hashing password: ", err);
                } else {
                    console.log("Hashed password: ", hash);
                    await db.query(
                        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)", [username, email, hash]
                    );
                    const user = await db.query("SELECT * FROM users WHERE email = $1", [email,]);
                    notes = [];
                    console.log( user.rows[0].userid);
                    res.render("index.ejs" ,  {notes: notes, userid: user.rows[0].userid, firstTime: true, name: user.rows[0].username});
                }
            });
        }
    } catch (err) {
        console.log(err);
    }
});

app.post("/submit", async (req, res) => {
    let noteName = req.body.noteName;
    let noteText = req.body.noteText;
    let userid = req.session.userid;
    addNote(userid, noteName, noteText);
    notes = await reloadDB(userid);
    res.redirect('/index');
});

app.delete("/deleteNote/:id/:userid", async (req, res) => {
    let id = req.params.id;
    let userid = req.params.userid;
    deleteNote(id, userid);
    notes = await reloadDB(userid);
    res.render("index.ejs", {notes: notes, userid: userid});
})

function addNote(userid, noteName, noteText){
    db.query("INSERT INTO keeper (userid, notename, notecontent) VALUES ( $1, '" + noteName + "','" + noteText + "');", [userid, ], (err, res) => {
        if (err) {
            console.error("Error executing query", err.stack);
        } else {
            console.log("Added a note");
        }
    });
}

function deleteNote (id, userid){
    db.query("DELETE FROM keeper WHERE id = " + id + " AND userid = $1;", [userid, ], (err, res) => {
        if (err) {
            console.error("Error executing query", err.stack);
        } else {
            console.log("Deleted a note");
        }
    });
}

async function reloadDB(userid) {
    let temp = await db.query("SELECT * FROM keeper WHERE userid = $1", [userid,]);
    return temp.rows;
}

passport.use(new Strategy(async function verify(username, password, cb) {
        try{
            const answer = await db.query("SELECT * FROM users WHERE email = $1", [username,]);

            if (answer.rows.length > 0){
                const user = answer.rows[0];
                const storedHashedPassword = user.password;
                bcrypt.compare(password, storedHashedPassword, (err, result) => {
                    if (err) {
                        console.log("Error comparing passwords: ", err);
                        return cb(err);
                    } else {
                        if (result) {
                            console.log("Password matched");
                            return cb(null, user);
                        } else {
                            console.log("HEY1");
                            authenticated = false;
                            return cb(null, false);
                        }
                    }
                })
            } else {
                console.log("HEY2");
                authenticated = false;
                return cb(null, false);
            }
        } catch (err) {
            console.log("HEY3");
            return cb(err);
        }
    })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}.`);
});