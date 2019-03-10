var fs = require('fs');
var jsSHA = require("jssha");
var httpSignature = require('http-signature');


exports.getParamFile = function (paramFile = './param.JSON' ) {
    return new Promise( function(resolve,reject){
      //console.log("In getParamFile");
      fs.readFile(paramFile, 'utf-8',function(err, data){
                if (err)
                    reject(err);
                else
                    resolve(data);
            })
    }
)};

exports.readParams = function (fileName) {
    return new Promise( function(resolve,reject){
      //console.log("In readparams, "+ fileName);
      fs.readFile(fileName, 'utf-8',function(err, data){
                if (err)
                    reject(err);
                else
                    resolve(data);
            })
    }
)};

exports.readKey = function(path) {
    return new Promise( function(resolve,reject){
      if(path.indexOf("~/") === 0) {
        path = path.replace("~", os.homedir())
      }
      //console.log("in read private " + param.privateKeyPath);
      fs.readFile(path, 'ascii', function(err, data){
              if (err)
                  reject(err);
              else
                  resolve(data);
          })
  }
)};

exports.sign = function (request, options) {

    var apiKeyId = options.tenancyId + "/" + options.userId + "/" + options.keyFingerprint;
    var headersToSign = [
        "host",
        "date",
        "(request-target)"
    ];

    var methodsThatRequireExtraHeaders = ["POST", "PUT"];

    if(methodsThatRequireExtraHeaders.indexOf(request.method.toUpperCase()) !== -1) {
        options.body = options.body || "";

        var shaObj = new jsSHA("SHA-256", "TEXT");
        shaObj.update(options.body);

        request.setHeader("Content-Length", options.body.length);
        request.setHeader("x-content-sha256", shaObj.getHash('B64'));

        headersToSign = headersToSign.concat([
            "content-type",
            "content-length",
            "x-content-sha256"
        ]);
    }

    httpSignature.sign(request, {
        key: options.privateKey,
        keyId: apiKeyId,
        headers: headersToSign
    });

    var newAuthHeaderValue = request.getHeader("Authorization").replace("Signature ", "Signature version=\"1\",");
    request.setHeader("Authorization", newAuthHeaderValue);
};
