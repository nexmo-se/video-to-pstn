'use strict'

//--------------

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser')
const app = express();
const request = require('request');

//-------------------

const Vonage = require('@vonage/server-sdk');

const apiRegion = process.env.API_REGION;

const options = {
  debug: true,
  apiHost: apiRegion
};

const vonage = new Vonage({
  apiKey: process.env.API_KEY,
  apiSecret: process.env.API_SECRET,
  applicationId: process.env.APP_ID,
  privateKey: './.private.key'
}, options);

// const vonage = new Vonage({
//   apiKey: process.env.API_KEY,
//   apiSecret: process.env.API_SECRET,
//   applicationId: process.env.APP_ID,
//   privateKey: './.private.key'
// });

//==========================================================

app.use(bodyParser.json());

//-----------

app.get('/answer', (req, res) => {

  // console.log(Date.now(), " /answer webhook");

  // const hostName = req.hostname;
  const uuid = req.query.uuid;

  const nccoResponse = [
      {
        "action": "conversation",
        "startOnEnter": true,
        "endOnExit": true,
        "name": "conference_" + req.query.uuid
      }
    ];

  res.status(200).json(nccoResponse);

});

//--------

app.post('/event', (req, res) => {

  // console.log(Date.now(), " /event webhook");

  if (req.body.status != undefined){
    console.log("status:", req.body.status);
  };

  // if (req.body.type != undefined && req.body.type === 'transfer'){
  if (req.body.status != undefined && req.body.status === 'answered'){

    const uuid = req.body.uuid;
    const hostName = req.hostname;
    const calleeNumber = req.body.to;
    const callerNumber = req.body.from;

    // console.log("call leg", uuid, "is now in the conference");

    // call PSTN party
    console.log("Now calling", calleeNumber, "with", callerNumber, "as caller-ID number.");

    vonage.calls.create({
      to: [{
        type: 'phone',
        number: calleeNumber
        }],
      from: {
        type: 'phone',
        number: callerNumber
        },
      // machine_detection: 'continue',  
      ringing_timer: 60,
      answer_url: ['https://' + hostName + '/answer1?original_uuid=' + uuid],
      answer_method: 'GET',
      event_url: ['https://' + hostName + '/event1?original_uuid=' + uuid],
      }, (err, res) => {
       if(err)  { 
                console.error('Outgoing call error:', err);
                console.log('error:', err.body.invalid_parameters); 
                }
       else { console.log('Outgoing call status:', res); }

    });

    // //- start named conference recording

    // const accessToken = vonage.generateJwt();

    // request.put(apiBaseUrl + '/conversations/' + req.body.conversation_uuid_to + '/record', {
    //     headers: {
    //         'Authorization': 'Bearer ' + accessToken,
    //         "content-type": "application/json",
    //     },
    //     body: {
    //       "action": "start",
    //       "event_url": ['https://' + hostName + '/record?original_uuid=' + uuid],
    //       "event_method": "POST",
    //       "split": "conversation",
    //       "channels": 2,
    //       "format": "mp3",
    //       "transcription": {
    //         "event_url": ["https://" + hostName + "/transcription?original_uuid=" + uuid],
    //         "event_method": "POST",
    //         "language":"en-US"
    //         }
    //     },
    //     json: true,
    //   }, function (error, response, body) {
    //     if (error) {
    //       console.log('error start recording:', error);
    //     }
    //     // else {
    //     //   console.log('response:', response);
    //     // }
    // });

    //--

    vonage.calls.stream.start(uuid,
      {
      stream_url: ['http://client-sdk-cdn-files.s3.us-east-2.amazonaws.com/us.mp3'], // ring back tone audio file 
      loop: 0
      }, (err, res) => {
       if (err) { console.error('Stream ', uuid, 'leg error: ', err); }
       else { console.log('Stream ', uuid, 'leg status: ', res); }
    });

  };

  res.status(200).send('Ok');
  
});

//-------------------

app.get('/answer1', (req, res) => {

  const nccoResponse = [
    // {
    //   "action":"talk",
    //   "text":"Hello, please wait, we are connecting you to your healthcare provider."
    // }
    // ,
    {
      "action": "conversation",
      "startOnEnter": true,
      "endOnExit": true,
      "name": "conference_" + req.query.original_uuid
    }
  ];

  res.status(200).json(nccoResponse);

});


//--------

app.post('/event1', (req, res) => {

  res.status(200).send('Ok');

  // console.log(Date.now(), ">>> /event1 webhook");

  // if (req.body.type != undefined && req.body.type === 'transfer'){
  if (req.body.status != undefined && req.body.status === 'answered'){  

    const originalUuid = req.query.original_uuid; // incoming call leg to platform
    // const uuid = req.body.uuid;                   // outgoing call leg from platform

    vonage.calls.stream.stop(originalUuid,
    (err, res) => {
     if (err) { console.error('Stream stop ', originalUuid, 'leg error: ', err); }
     else { console.log('Stream stop', originalUuid, 'leg status: ', res); }
    })

    // vonage.calls.talk.start(uuid,
    //   {
    //   text: 'You may now speak',
    //   }, (err, res) => {
    //    if (err) { console.error('Talk ', uuid, 'leg error: ', err); }
    //    else { console.log('Talk ', uuid, 'leg status: ', res); }
    // });

    // vonage.calls.talk.start(originalUuid,
    //   {
    //   text: 'You may now speak',
    //   }, (err, res) => {
    //    if (err) { console.error('Talk ', originalUuid, 'leg error: ', err); }
    //    else { console.log('Talk ', originalUuid, 'leg status: ', res); }
    // });

  };

});

//--------

app.post('/record', (req, res) => {

  res.status(200).send('Ok');

  vonage.files.save(req.body.recording_url, './post-call-data/' + req.body.conversation_uuid + '.mp3', (err, res) => {
    if (err) { console.error('error downloading audio recording file', req.body.recording_url, JSON.stringify(err)); }
    else { console.log('download recording file status:', res); } 
  });    

});

//--------

app.post('/transcription', (req, res) => {

  res.status(200).send('Ok');

  const accessToken = vonage.generateJwt();

  console.log('req.body.transcription_url:', req.body.transcription_url);

  request.get(req.body.transcription_url, {
      headers: {
          'Authorization': 'Bearer ' + accessToken,
          "content-type": "application/json",
      },
      json: true,
    }, function (error, response, body) {
      // console.log("\nbody:", body);
      console.log("\nchannel 0:", body.channels[0]);
      console.log("\nchannel 1:", body.channels[1]);
      console.log("\nchannel 0 - words:", body.channels[0].transcript[0].words);
      console.log("\nchannel 1 - words:", body.channels[1].transcript[0].words);
  });  

});

//--------

app.post('/rtc', (req, res) => {

  res.status(200).send('Ok');

});

//=========================================

const port = process.env.PORT || 8000;

app.listen(port, () => console.log(`Server application listening on port ${port}!`));

//------------
