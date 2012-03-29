// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*globals define window console */

define([], 
function() {

  function RESTChannelClient(server) {
    this.server = server;
    this._open(server);
  }
  
  RESTChannelClient.prototype = {
    _open: function(server) {
      this.channel = new window.MessageChannel();
      this.channel.onmessage = this._accept.bind(this);
      server.postMessage('RESTChannelClient', '*', [this.channel.port2]);
    },
    
    _accept: function(event) {
      console.log("RESTChannelClient ", event);
      if (event.data && event.data === "RESTChannelServer") {
        console.log("RESTChannelClient accept ", event);
      }
    }
    
  };
  
  return RESTChannelClient;

});