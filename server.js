const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()


// mongoose, use npm install mongoose
let mongoose = require("mongoose");

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

// for the json and form-data part to work
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// change the database name in mongo_uri env
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  username: String
})

const User = mongoose.model('User', userSchema)

const logSchema = new mongoose.Schema({
  userId: String,
  description: String,
  duration: Number,
  date: {type: Date, default: Date.now}, 
  username: String
})

const Log = mongoose.model('Log', logSchema)

app.post('/api/exercise/new-user', (req, res) => {
  var username = req.body.username
  User.findOne({username: username}, (err, data) =>{
    if (err) console.error(err);
    if (!data){
      var newuser = new User({username: username})
      newuser.save((err, data) => {
        if (err) console.error(err);
        return res.json({_id: data._id, username: data.username})
      })
    } else {
      return res.send(`The username "${username}" already exists. Please try another.`)
    }
  })
});

app.get('/api/exercise/users', (req, res) => {
  User.find((err, data) => {
    if (err) console.error(err);
    const result = data.map(({username, _id }) => ({username, _id}))
    res.send(result)
  })
});

function isValidDate(dateString) {
  var regEx = /^\d{4}-\d{2}-\d{2}$/;
  if(!dateString.match(regEx)) return false;  // Invalid format
  var d = new Date(dateString);
  var dNum = d.getTime();
  if(!dNum && dNum !== 0) return false; // NaN value, Invalid date
  return d.toISOString().slice(0,10) === dateString;
}

app.post('/api/exercise/add', (req, res) => {
  let {userId, description, duration, date} = req.body

  // validate duration
  if (isNaN(duration)){
    return res.send('Please enter a correct duration in number form')
  }
  duration = parseInt(duration)
  if (duration <= 0){
    return res.send(`Invalid duration ${duration}. Please enter a duration > 0`)
  }

  // validate description
  if (!description) {
    return res.send('Please enter a non empty description.')
  }
  
  // validate date
  if (!!date && !isValidDate(date)){
    return res.send(`The date ${date} is not valid`)
  }
  if (!date) {
    date = new Date();
  } 

  // validate id and if found then add the log.
  User.findById(userId, (err, data) => {
    if (err) console.error(err)
    if (!data){
      return res.send('User ID not found.')
    } else {
      username = data.username
      var newlog = new Log({ userId, duration, description, date, username})
      newlog.save((err, data) => {
        date = data.date // needed because if date in the req is in correct form, then it is in the format of string and the string does not have any method toDateString.
        if (err) console.error(err)
        res.send({_id: userId, duration, description, date: date.toDateString() , username})
      })
    }
  })
})

app.get('/api/exercise/log', (req, res) => {
  var {userId, from, to, limit} = req.query
  var fromPresent = true
  var toPresent = true
  if (!from) {
    from = new Date(-8640000000000000)
    fromPresent = false
  } else if (!isValidDate(from)) {
    return res.send(`The "from" date ${from} is not valid`)
  }

  if (!to) {
    to = new Date(8640000000000000)
    toPresent = false
  } else if (!isValidDate(to)) {
    return res.send(`The "to" date ${to} is not valid`)
  }

  if (!limit) {
    limit = 1000
  } else {
    if (isNaN(limit)){
      return res.send('Please enter a numerical limit.')
    } 
    limit = parseInt(limit)
    if (limit < 1){
      limit = 1000
    }
  }
  User.findById(userId, (err, data) => {
    if (err) console.log(err)
    if (!data) return res.send('User does not exist with this id')
    const username = data.username

    Log.find({ 
      userId: userId,
      date: {
        $gte: from, 
        $lte: to
      }
     }, 
     null, 
     {limit: limit},
     (err, data) => {
       if (err) console.error(err);
       data = data.map(({description, duration, date}) => ({description, duration, date: date.toDateString()}));
       var result = {_id: userId, username }
       if (fromPresent){
         result.from = from
       }
       if (toPresent) {
         result.to = to
       }
       result.count = data.length
       result.log = data
       res.send(result)
     })
  })
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
