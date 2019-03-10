var argv = require('minimist')(process.argv.slice(2));

var theHelp = argv['h'];
if (theHelp != undefined) {
	console.log('OCI_Monitor command');
	console.log('  -a : show only active elements');
	process.exit(1);
}
var showActive = argv['a'];

var fs = require('fs');
//var httpSignature = require('http-signature');
//var jsSHA = require("jssha");
//var https = require('https');
//var Qs = require("Qs");

// My Libs
var my = require('./libs/myLib.js');
var myC = require('./libs/myLibCore.js')

var param = ""
var pfile = ""
var privateKey = ""
var tenancyView = {};

function genericLoop(serviceDomainType, URLpath) {
  return new Promise( function(resolve,reject){

		var promiselist = [];

    // Building queries for instances in all compartments
    for (var i in tenancyView.Compartments){
      //console.log("no "+ i + ", name=" + tenancyView.Compartments[i]['name']);

      // For clusters
			var promiseJ = myC.listTenancyElement(serviceDomainType, URLpath, privateKey, param, tenancyView.Compartments[i]['OCID']);
      promiselist.push(promiseJ);
    }
    Promise.all(promiselist).then ( function Clusterlist(responseJ) {
      // console.log("Elements from all compartments : ");
      // console.log(responseJ);
      resolve(responseJ)
    });
  }
)}

function storeResults(key, elements, response) {
	tenancyView[key] = [];
	for(var myKey in response) {
		for (var myKey2 in response[myKey]) {
			var data1 = {
					'compartmentName': tenancyView['Compartments'][myKey]['name'] };
			// console.log("Compartment " + String(myKey));

			for (var i in elements) {
				var data2 = {[elements[i]]: response[myKey][myKey2][elements[i]]}
				Object.assign(data1, data2)
				// console.log("   elem:" + elements[i] + ", value:" + response[myKey][myKey2][elements[i]]);
			}
			tenancyView[key].push(data1);
		}
	}

};

// Chaining of logical steps with .then

my.getParamFile()  // Read the param JSON to get param file to use
.then( function Step1(response1) {
    pfile = JSON.parse(response1);
    console.log("Reading parameter file "+pfile.datafile);

    // Now read this file to get Tenancy details
    return my.readParams(pfile.datafile)
} )
.then( function Step2(response2) {
    param = JSON.parse(response2);
    console.log("Parameters read, tenancy name = " + param.tenancyName);

    // Now read private key file
    return my.readKey(param.privateKeyPath)
} )
.then ( function Step3(response3) {
    privateKey = response3;
    console.log("Private key read ");
    //console.log(privateKey);

    // Get Compartments List
    return myC.listTenancyElement('identity', '/20160918/compartments', privateKey, param, param.tenancyId);

})
.then ( function Step5(response5) {
    console.log("Compartment list obtained");
    //console.log(response4);
    var key = 'Compartments';
    tenancyView[key] = [];
    for(var myKey in response5) {
      // console.log("\nCompartment " + myKey + ": Name: " + response5[myKey]['name'] + "    OCID: ", response5[myKey]['id']);
      var data = {
          'name': response5[myKey]['name'],
          'OCID': response5[myKey]['id']
      };
      tenancyView[key].push(data);
    }
    tenancyView['nbCompartments'] =  Number(myKey) + 1
    //console.log(tenancyView);
    console.log("Nb of compartments=" + tenancyView.nbCompartments);

    return genericLoop('iaas','/20160918/instances');

})
.then ( function Step6a(response) {
    console.log("Instances obtained");
    //console.log(tenancyView);
		storeResults('Instances', ['displayName','lifecycleState' ], response);

    return genericLoop('database', '/20160918/autonomousDatabases');
})
.then ( function Step6d(response) {
    console.log("Autonomous DBs obtained");
    //console.log(response);
		storeResults('autonomousDatabases', ['dbName','lifecycleState','dbWorkload' ], response);

    return genericLoop('CONTAINERENGINE', '/20180222/clusters');
})
.then ( function Step7a(response) {
    console.log("Clusters obtained");
    //console.log(response);
		storeResults('clusters', ['name','lifecycleState','id' ], response);

		return genericLoop('CONTAINERENGINE', '/20180222/nodePools');
})
.then ( function Pools(response) {
		console.log("Node Pools obtained");
		//console.log(response);
		// for the DBs: 'database', '/20160918/dbSystems'   ==> displayName, lifecycleState
		storeResults('nodePools', ['name','lifecycleState','clusterId' ], response);


		return genericLoop('database', '/20160918/dbSystems');
		// return myC.listTenancyElement('database', '/20160918/dbSystems', privateKey, param, tenancyView.Compartments[1]['OCID']);

})
.then ( function Step9a(response) {
		console.log("oci dbs obtained");
		//console.log(response);
		// for the DBs: 'database', '/20160918/dbSystems'   ==> displayName, lifecycleState
		storeResults('ocidb', ['displayName','lifecycleState' ], response);

    // Get Users List
    return myC.listTenancyElement('identity', '/20160918/users', privateKey, param, param.tenancyId);
})
.then ( function DisplayResult(response7a) {

  console.log("User list obtained");
  // console.log(response7a);
  var key = 'Users';
  tenancyView[key] = [];
  for(var myKey in response7a) {
     // console.log("\User " + myKey + ": Name: " + response7a[myKey]['name'] + "    OCID: ", response7a[myKey]['id']);
    var data = {
        'name': response7a[myKey]['name'],
        'email': response7a[myKey]['description']
    };
    tenancyView[key].push(data);
  }
  tenancyView['nbUsers'] =  Number(myKey) + 1
  //console.log(tenancyView);
  console.log("Nb of users = " + tenancyView.nbUsers);

  if (showActive) {
    console.log("Active instances:");
    for (var myKey in tenancyView.Instances)
      if (tenancyView.Instances[myKey]['state'] == 'RUNNING') {
        console.log(tenancyView.Instances[myKey]['instanceName'] + "." + tenancyView.Instances[myKey]['compartmentName']);
      }
    console.log("Active ATP DBs:");
    for (var myKey in tenancyView.autonomousDatabases)
      if (tenancyView.autonomousDatabases[myKey]['state'] == 'ACTIVE') {
        console.log(tenancyView.autonomousDatabases[myKey]['dbName'] + "." + tenancyView.autonomousDatabases[myKey]['compartmentName']);
      }
  }
  else {
    console.log("begin of DisplayResult");
		console.log("---------------------------");
		console.log("Instances");
    console.log(tenancyView.Instances);
		console.log("---------------------------");
		console.log("Autonomous Dbs");
    console.log(tenancyView.autonomousDatabases);
		console.log("---------------------------");
		console.log("Clusters");
		console.log(tenancyView.clusters);
		console.log("---------------------------");
		console.log("Nodepools");
		console.log(tenancyView.nodePools);
		console.log("---------------------------");
		console.log("ociDBs");
		console.log(tenancyView.ocidb);

  }
//  console.log(tenancyView.Users);

// Write all info to file "myjsonfile.json"
  var json = JSON.stringify(tenancyView);
      fs.writeFileSync('myjsonfile.json', json);
})
