  
var http = require('http');
var ModBusClient = require('./modbus')
var LightLogger = require('./light_logger')
var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-modbus-lights", "ModbusLights", ModbusLights, true);
}

// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function ModbusLights(log, config, api) {
  log("ModbusLights Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = [];
  this.light_logger = new LightLogger()
  this.modbus = new ModBusClient()
  this.modbus.connect(function (){
  	setInterval(function (){
  		this.modbus.updateLightState(function(){
  			this.modbus.getStateArray().reverse().forEach(function (value, i) {
  				//console.log(this.accessories.find(el => el.displayName == `Light ${i}`).getService(`Light ${i}`))
  				var light_name = `Light ${i}`
  				var real_state = value == '0'
  				var service = this.accessories.find(el => el.displayName == light_name).getService(Service.Lightbulb)
  				if (service.getCharacteristic(Characteristic.On).value != real_state){
  					console.log(light_name, service.getCharacteristic(Characteristic.On).value, real_state)
  					service.setCharacteristic(Characteristic.On, real_state)
  				}
  			}.bind(this))
  			this.api.updatePlatformAccessories(this.accessories);
  		}.bind(this))
  	}.bind(this), 1000)
  }.bind(this))

  this.requestServer = http.createServer(function(request, response) {
    if (request.url === "/add") {
      this.addAccessory(new Date().toISOString());
      response.writeHead(204);
      response.end();
    }

    if (request.url === "/add_all") {
      this.addModbusAccessories();
      response.writeHead(204);
      response.end();
    }

    if (request.url === "/get_acs_all") {
    	response.writeHead(200, { 'Content-Type': 'application/json',
                          'Trailer': 'Content-MD5' });
		response.write(JSON.stringify(this.accessories));
		response.end();
    }

    if (request.url === "/get_acs") {
    	response.writeHead(200, { 'Content-Type': 'application/json',
                          'Trailer': 'Content-MD5' });
		response.write(String(this.accessories.map(e => `\n${e.displayName} is on: ${e.getService(Service.Lightbulb).getCharacteristic(Characteristic.On).value}`)));
		response.end();
    }

    if (request.url == "/reachability") {
      this.updateAccessoriesReachability();
      response.writeHead(204);
      response.end();
    }

    if (request.url == "/remove") {
      this.removeAccessory();
      response.writeHead(204);
      response.end();
    }
  }.bind(this));

  this.requestServer.listen(18081, function() {
    platform.log("Server Listening...");
  });

  if (api) {
      // Save the API object as plugin needs to register new accessory via this object
      this.api = api;

      // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
      // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      // Or start discover new accessories.
      this.api.on('didFinishLaunching', function() {
        platform.log("DidFinishLaunching");
      }.bind(this));
  }
}

ModbusLights.prototype.setupLightService = function(service, accessory) {
	service.getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      	this.modbus.setLight(accessory.displayName.split(' ')[1], value)
      	this.light_logger.saveChange(this.modbus.light_state)
	    console.log(accessory.displayName, "Light -> " + value);
	    callback();
    }.bind(this));
}

ModbusLights.prototype.configureAccessory = function(accessory) {
  this.log(accessory.displayName, "Configure Accessory");
  var platform = this;

  // Set the accessory to reachable if plugin can currently process the accessory,
  // otherwise set to false and update the reachability later by invoking 
  // accessory.updateReachability()
  accessory.reachable = true;

  accessory.on('identify', function(paired, callback) {
    platform.log(accessory.displayName, "Identify!!!");
    callback();
  });

  if (accessory.getService(Service.Lightbulb)) {
  	this.setupLightService(accessory.getService(Service.Lightbulb), accessory)
  }

  this.accessories.push(accessory);
}

ModbusLights.prototype.addAccessory = function(accessoryName) {
  this.log("Add Accessory");
  var platform = this;
  var uuid;

  uuid = UUIDGen.generate(accessoryName);

  var newAccessory = new Accessory(accessoryName, uuid);
  newAccessory.on('identify', function(paired, callback) {
    platform.log(newAccessory.displayName, "Identify!!!");
    callback();
  });
  // Plugin can save context on accessory to help restore accessory in configureAccessory()
  // newAccessory.context.something = "Something"
  
  // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
  this.setupLightService(newAccessory.addService(Service.Lightbulb, accessoryName), newAccessory)

  this.accessories.push(newAccessory);
  this.api.registerPlatformAccessories("homebridge-modbus-lights", "ModbusLights", [newAccessory]);
}

ModbusLights.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  this.log(this.accessories);
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(true);
  }
}

ModbusLights.prototype.addModbusAccessories = function() {
	this.removeAccessory()

    var lights = this.modbus.getStateArray()
	lights.forEach(function (value, i) {
		this.log(value, i)
		this.addAccessory(`Light ${i}`)
	}.bind(this))
}

// Sample function to show how developer can remove accessory dynamically from outside event
ModbusLights.prototype.removeAccessory = function() {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories("homebridge-modbus-lights", "ModbusLights", this.accessories);

  this.accessories = [];
}
