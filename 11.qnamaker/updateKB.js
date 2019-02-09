'use strict';
var exports = module.exports = {};
let fs = require('fs');
let https = require('https');

// **********************************************
// *** Update or verify the following values. ***
// **********************************************

// Replace this with a valid subscription key.
let subscriptionKey = '7a24b2d46111435ebcb3ca1402ba0ae7';

// NOTE: Replace this with a valid knowledge base ID.
let kb = '60a88ab6-7e7d-4864-aa2f-2047f7b288f6';

let host = 'westus.api.cognitive.microsoft.com';
let service = '/qnamaker/v4.0';
let method = '/knowledgebases/';
let pretty_print = function (s) {
    return JSON.stringify(JSON.parse(s), null, 4);
}

// callback is the function to call when we have the entire response.
let response_handler = function (callback, response) {
    let body = '';
    response.on ('data', function (d) {
        body += d;
    });
    response.on ('end', function () {
// Call the callback function with the status code, headers, and body of the response.
        callback ({ status : response.statusCode, headers : response.headers, body : body });
    });
    response.on ('error', function (e) {
        console.log ('Error: ' + e.message);
    });
};

// Get an HTTP response handler that calls the specified callback function when we have the entire response.
let get_response_handler = function (callback) {
// Return a function that takes an HTTP response, and is closed over the specified callback.
// This function signature is required by https.request, hence the need for the closure.
    return function (response) {
        response_handler (callback, response);
    }
}

// callback is the function to call when we have the entire response from the PATCH request.
let patch = function (path, content, callback) {
    let request_params = {
        method : 'PATCH',
        hostname : host,
        path : path,
        headers : {
            'Content-Type' : 'application/json',
            'Content-Length' : Buffer.byteLength(content),
            'Ocp-Apim-Subscription-Key' : subscriptionKey,
        }
    };
    

// Pass the callback function to the response handler.
    let req = https.request (request_params, get_response_handler (callback));
    req.write (content);
    req.end ();
}

// callback is the function to call when we have the entire response from the POST request.
let post = function (path, content, callback) {
    let request_params = {
        method : 'POST',
        hostname : host,
        path : path,
        headers : {
            'Content-Type' : 'application/json',
            'Content-Length' : Buffer.byteLength(content),
            'Ocp-Apim-Subscription-Key' : subscriptionKey,
        }
    };

// Pass the callback function to the response handler.
    let req = https.request (request_params, get_response_handler (callback));
    req.write (content);
    req.end ();
}

// callback is the function to call when we have the entire response from the GET request.
let get = function (path, callback) {
    let request_params = {
        method : 'GET',
        hostname : host,
        path : path,
        headers : {
            'Ocp-Apim-Subscription-Key' : subscriptionKey,
        }
    };

// Pass the callback function to the response handler.
    let req = https.request (request_params, get_response_handler (callback));
    req.end ();
}

// callback is the function to call when we have the response from the /knowledgebases PATCH method.
let update_kb = function (path, req, callback) {
    console.log ('Calling ' + host + path + '.');
// Send the PATCH request.
    patch (path, req, function (response) {
// Extract the data we want from the PATCH response and pass it to the callback function.
        callback ({ operation : response.headers.location, response : response.body });
    });
}

// callback is the function to call when we have the response from the GET request to check the status.
let check_status = function (path, callback) {
    console.log ('Calling ' + host + path + '.');
// Send the GET request.
    get (path, function (response) {
// Extract the data we want from the GET response and pass it to the callback function.
        callback ({ wait : response.headers['retry-after'], response : response.body });
    });
}



// callback is the function to call when we have the response from the /knowledgebases POST method.
let publish_kb = function (path, req, callback) {
    console.log ('Calling ' + host + path + '.');
// Send the POST request.
    post (path, req, function (response) {
// Extract the data we want from the POST response and pass it to the callback function.
        if (response.status == '204') {
            let result = {'result':'Success'};
            callback (JSON.stringify(result));
        }
        else {
            callback (response.body);
        }
    });
}




exports.update_KB_from_UI = function(req, res) {

    let main_req = {
        'add': {
          // 'qnaList': [
          //   {
          //     'id': 1,
          //     'answer': 'You can change the default message if you use the QnAMakerDialog. See this for details: https://docs.botframework.com/en-us/azure-bot-service/templates/qnamaker/#navtitle',
          //     'source': 'Custom Editorial',
          //     'questions': [
          //       'How can I change the default message from QnA Maker?'
          //     ],
          //     'metadata': []
          //   }
          // ],
          'urls': [
          ]
        },
        'update' : {
          'name' : 'Corrus KB'
        },
        'delete': {
          'ids': [
            0
          ]
        }
      };
      main_req.add.urls.push(req.body.url);
      main_req.update.name = req.body.name;
      var path = service + method + kb;
        var path_for_publish = service + method + kb;
        // Convert the request to a string.
        let content = JSON.stringify(main_req);

    update_kb (path, content, function (result) {
        console.log (pretty_print(result.response));
    // Loop until the operation is complete.
        let loop = function () {
            path = service + result.operation;
    // Check the status of the operation.
            check_status (path, function (status) {
    // Write out the status.
                console.log (pretty_print(status.response));
    // Convert the status into an object and get the value of the operationState field.
                var state = (JSON.parse(status.response)).operationState;
    // If the operation isn't complete, wait and query again.
                if (state == 'Running' || state == 'NotStarted') {
                    console.log ('Waiting ' + status.wait + ' seconds...');
                    setTimeout(loop, status.wait * 1000);
                }else if(state == 'Succeeded'){
                    publish_kb (path_for_publish, '', function (result) {
                        console.log (pretty_print(result));
                        var msg = (JSON.parse(result));
                        res.header("Access-Control-Allow-Origin", "*");
                        res.header("Access-Control-Allow-Headers", "X-Requested-With");
                        res.send(msg);
                    });
                }
            });
        }
    // Begin the loop.
        loop();
    });
};