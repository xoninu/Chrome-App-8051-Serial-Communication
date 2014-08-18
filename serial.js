
const PACKET_SOP_DATA     0x02
const PACKET_EOP_DATA     0x03
const LED_TYPE_DATA       0x4C //'L'
const SWITCH_TYPE_DATA    0x53 //'S'

const PACKET_SOP_INDEX    0
const PACKET_TYPE_INDEX   1
const PACKET_ID_INDEX     2
const PACKET_STATE_INDEX  3
const PACKET_EOP_INDEX    4

const PACKET_DATA_LEN (PACKET_EOP_INDEX + 1)

const LED_ON_STATE = 'O';
const LED_OFF_STATE = 'F';

var g_connectionID = -1;

function onConnect(connectionInfo) {
  if (!connectionInfo) {
    console.log("Could not open");
    setStatus('Could not open');
    return;
  }

  g_connectionID = connectionInfo.connectionId;
  setStatus('Connected');
  console.log("Connected");
  console.log(g_connectionID);
 };

function setStatus(status) {
  document.getElementById('status').innerText = status;
}

function buildPortPicker(ports) {
  var eligiblePorts = ports.filter(function(port) {
    console.log("Serial Path:" + port.path);
    console.log("Vendor ID:" + port.vendorid);
    console.log("Product ID:" + port.productid);
    console.log("Displayname:" + port.displayName);
    
    return port.path;
  });

  var portPicker = document.getElementById('ports');
  
  eligiblePorts.forEach(function(port) {
    var portOption = document.createElement('option');
    portOption.value = portOption.innerText = port.path;
    portPicker.appendChild(portOption);
  });

  portPicker.onchange = function() {

    console.log("portPicker.onchange");

    if (g_connectionID != -1) {
      chrome.serial.disconnect(g_connectionID, openSelectedPort);
      return;
    }

    openSelectedPort();

  };
}

function openSelectedPort() {

  var json = getCoonectionOptionsAsJSON();
  console.log(json);
  chrome.serial.connect(getSelectedValue('ports'), json, onConnect);
}

/* Interprets an ArrayBuffer as UTF-8 encoded string data. */
function ab2str(buf) {
  var bufView = new Uint8Array(buf);
  var encodedString = String.fromCharCode.apply(null, bufView);
  //decodeURIComponent(escape(encodedString));
  encodedString = encodedString.replace(new RegExp('\r?\n','g'), '<br />');
  return encodedString;
};

function onReceive(receiveInfo) {

  console.log("onReceive");
  console.log(receiveInfo.connectionId);

  if (receiveInfo.connectionId != g_connectionID) {
    return;
  }

  var str = ab2str(receiveInfo.data);

  console.log(str);

  var output = document.getElementById('output');
  output.innerHTML = output.innerHTML + str;
};

function onReceiveError(errorInfo) {
   console.log("onReceiveError");
 
  if (errorInfo.connectionId === g_connectionID) {
   console.log(errorInfo.error);
  }
};

function onHandleConnect(){

  console.log("onHandleConnect");

  if (g_connectionID != -1) {
      chrome.serial.disconnect(g_connectionID, openSelectedPort);
      return;
    }

    openSelectedPort();
}

function onHandleDisconnect(){

  console.log("onHandleDisconnect");

  isConnectionAlive(g_connectionID, function cbResult(result){
 
    if (result == true){
    
      chrome.serial.disconnect(g_connectionID, function(result) {
        if (result != true){
          console.log("Failed to disconnect.");
        }
      });

      setStatus('Disconnected....');
    }
    else {
      console.log("CoonectionID (" + g_connectionID + ") Not found in current connections.")
    }

    g_connectionID = -1;

  });
}

function isConnectionAlive(connectionID, cbResult){

  console.log("isConnectionAlive");
  chrome.serial.getConnections(function connections(connectionInfos){
    
    var arrayLength = connectionInfos.length;
    console.log(arrayLength);
    for (var i = 0; i < arrayLength; i++) {
      if (connectionInfos[i].connectionId === connectionID){
        console.log("Found");
        cbResult(true);
        return;
      }
    }
    
    console.log("Not Found");
    cbResult(false);
  });
}

function getSelectedValue(elementID) {

  var element = document.getElementById(elementID);
  return element.options[element.selectedIndex].value;
}

function getCoonectionOptionsAsJSON() {

  var json = {};

  json["bitrate"] = parseInt(getSelectedValue('bitrate'));
  json["dataBits"] = getSelectedValue('databits');
  json["stopBits"] = getSelectedValue('stopbits');
  json["parityBit"] = getSelectedValue('paritybit');

  return json;
}

function getLedNewState(ledstate){

  console.log("getLedNewState: " + ledstate);

    if (ledstate == LED_ON_STATE){
      return LED_OFF_STATE;
    }

    return LED_ON_STATE;
}

function formLedPacket(ledid, ledstate){

  console.log("formLedPacket");
  console.log("ledid: " + ledid);
  console.log("ledstate: " + ledstate);

  var buf = new ArrayBuffer(PACKET_DATA_LEN);
  var bufView = new Uint8Array(buf);
  bufView[PACKET_SOP_INDEX] = PACKET_SOP_DATA;
  bufView[PACKET_TYPE_INDEX] = LED_TYPE_DATA;
  bufView[PACKET_ID_INDEX] = ledid;
  bufView[PACKET_STATE_INDEX] = ledstate;
  bufView[PACKET_EOP_INDEX] = PACKET_EOP_DATA;

  return buf;
}

function sendLEDPacket(ledPacket, cbResult){

  console.log("sendLEDPacket");

  if (g_connectionID == -1){
    console.log("No connetion open");
    cbresult(false);
    return;
  }

  chrome.serial.send(g_connectionID, ledPacket, function onsend(sendInfo){

    console.log("Bytes sent: " + sendInfo.bytesSent);
    console.log("Error: " + sendInfo.error);

    if (sendInfo.bytesSent == PACKET_DATA_LEN){
      cbresult(true);
    }

    cbresult(false);
  });
}

//Handle led button click
function onHandleLedClick(event){

  console.log("onHandleLedClick");
  console.log("ID: " + event.target.id);
  console.log("ledstate: " + event.target.dataset.ledstate);

  if (g_connectionID == -1){
    console.log("No connetion open");
    return;      
  }

  var newstate = getLedNewState(event.target.dataset.ledstate);

  sendLEDPacket(formLedPacket(event.target.dataset.ledid.charCodeAt(0), newstate.charCodeAt(0)), function cbResult(result){
 
    if (result == true){

      console.log("lednewstate: " + newstate);
    
      //Update element led state
      document.getElementById(event.target.id).dataset.ledstate = newstate;  
    }
    else {

      console.log("Failed to send led packet.");
    }
  });
}

chrome.serial.onReceive.addListener(onReceive);
chrome.serial.onReceiveError.addListener(onReceiveError);

onload = function() {

document.getElementById('connect').addEventListener('click', onHandleConnect);
document.getElementById('disconnect').addEventListener('click', onHandleDisconnect);

$('.led').click(onHandleLedClick);

  chrome.serial.getDevices(function(devices) {
    buildPortPicker(devices)
  });
};