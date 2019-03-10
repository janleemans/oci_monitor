var Qs = require("Qs");
var https = require('https');
var my = require('./myLib.js')

exports.listTenancyElement = function (serviceDomainType, URLpath, privateKey, param, compartmentId) {
  return new Promise( function(resolve,reject){
    var params = {
      compartmentId: compartmentId
    }
    var host = serviceDomainType + "." + param.servicesDomain
    var options = {
        host: host,
        path: URLpath + "?" + Qs.stringify(params),
        method: 'GET'
    };
    // console.log("\noptions get: ",options);

    var request = https.request(options, function(res) {
      // reject on bad status
      if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('JLE statusCode=' + res.statusCode));
      }
      // cumulate data
      var body = [];
      res.on('data', function(chunk) {
          body.push(chunk);
      });

      // resolve on end
      res.on('end', function() {
          try {
              body = JSON.parse(Buffer.concat(body).toString());
          } catch(e) {
              reject(e);
          }
          resolve(body);
        });
      });
  // reject on request error
      request.on('error', function(err) {
      // This is not a "Second reject", just a different sort of failure
        console.log("in error");
        reject(err);
      });
    my.sign(request, {
        privateKey: privateKey,
        keyFingerprint: param.keyFingerprint,
        tenancyId: param.tenancyId,
        userId: param.authUserId
    });
    request.end();
  }
)};
