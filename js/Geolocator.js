'use strict'

class Geolocator {

  //Geolocator constructor
  constructor() {
    this._$body = $('body');
    this._$mapObject = $('#map');
    this._$formObject = $('#form');
    this._$send = $('#send');
    this._$next = $('#next');
    this._$inputArea = $('#input-area');
    this._$result = $('#result');
    this._$message = $('#message');
    this._$searchBox = $('#search-box');
    this._geocoder = new google.maps.Geocoder();
    this._latlng = new google.maps.LatLng(10.0, 8.0); 
    this._options = {
      zoom: 17,
      center: this._latlng,
    }

    this._generatedState = ""; 
    this._generatedArea = "";
    this._generatedStreet = "";
    this._defaultCoordinates = "";
    
    this._init();
  }

  _init() {
    this._populateStates();
    this._addEventListenerToBody();   
  }

  _populateStates() {
    $.ajax({
      type: 'get',
      dataType: 'json',
      url: 'json/states.json',
      success: (returnedObject) => {
        this._doLoadStates(returnedObject);
      }
    });
  }

  _addEventListenerToBody() {
    this._$body.on('click', (eventObject) => {
      const $target = $(eventObject.target);
      if ($target.is('input[type="button"]#send')) {
        this._useInputs();
      } else if ($target.is('input[type="button"]#continue')) {
        this._showPreview();
      } else if ($target.is('input[type="button"]#restart')) {
        this._rePopulate();
      } else if ($target.is('input[type="button"]#back')) {
        this._back();
      }
    });
  }

  _useInputs() {
    const number = $('input#number').val() ? $('input#number').val() : "";
    if (number === '') {
      alert(':::Please enter your house/business address number.');
      $('input#number').focus();
      return;
    }

    const street = $('input#street').val() ? $('input#street').val() : "";
    const area = $('input#area').val() ? $('input#area').val() : "";
    const state = $('#state').val() ? $('#state').val() : "";
    const country = 'Nigeria';    
    const address = `${street} ${area}, ${state}, ${country}`;
    this._showMap(address, state);
  }

  _showMap(address, state) {
    this._computeAddress(address, state);
    this._resetElementsView();
  }

  _resetElementsView() {
    this._$formObject.show(1200);
    this._$mapObject.show(1200);
    this._$next.show(1200);
    this._$send.show(1200);
  }

  _computeAddress(address, state) {
    this._geocoder.geocode( { 'address': address}, (results, status) => {
      let map = new google.maps.Map(document.getElementById('map'), this._options);
      if (status == google.maps.GeocoderStatus.OK) {
        this._setupMap(map, results, state);
      } else {
        let that = this;
        this._showMessageElement(`:::Unable to locate ${address}. Showing your Current location.`);
        //this._cancelInputs();
        this._determineGeoLocation(that, map);
      }
    });
  }

  _determineGeoLocation(that, map) {
    if (navigator.geolocation) {
      that._caterForDefaultLocation(that, map)
    } else {
      this._showMessageElement(`:::Geolocation is not supported by this browser.`);
    }
  }

  _setupMap(map, results, state) {
    map.setCenter(results[0].geometry.location);
    let marker = this._getMarker(map);
    marker.setTitle(state);
    marker.setPosition(results[0].geometry.location);
    this._manipulateMap(map, marker);
    this._$message.hide(1000);
  }

  _caterForDefaultLocation(that, map) {
    navigator.geolocation.getCurrentPosition((position) => {
      that._useLocation(that, map, position);
    }, (error) => {
      that._runCases(that, error);
    });
  }

  _useLocation(that, map, position) {
    let coordinates = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
    map.setCenter(coordinates);
    let marker = this._getMarker(map);
    marker.setPosition(coordinates);
    that._manipulateMap(map, marker);
  }

  _runCases(that, error) {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        that._$message.html(`User denied the request for Geolocation.`);
        that._$message.show(1000);
        break;
      case error.POSITION_UNAVAILABLE:
        that._$message.html(`Location information is unavailable.`);
        that._$message.show(1000);
        break;
      case error.TIMEOUT:
        that._$message.html(`The request to get user location timed out.`);
        that._$message.show(1000);
        break;
      case error.UNKNOWN_ERROR:
        that._$message.html(`An unknown error occurred.`);
        that._$message.show(1000);
        break;
    }
  }

  _cancelInputs() {
    $('input#street').val('');
    $('input#area').val('');
    $('#state').val('');
  }

  _manipulateMap(map, marker) {
    this._setMapActionListeners(map, marker);
    this._setLatitudeAndLongitude(marker.position.lat(), marker.position.lng());        
    this._setAutoCompleteFunctionality(map);
  }

  _setMapActionListeners(map, marker) {
    google.maps.event.addListener(map, 'click', (event) => {
      let location = event.latLng;
      marker.position = location;
      this._resetMap(map, marker);
    });

    marker.addListener('drag', (eventObject) => {
      this._resetMap(map, marker);
    });

  }

  _resetMap(map, marker) {
    map.setCenter(marker.getPosition());
    this._setLatitudeAndLongitude(marker.position.lat(), marker.position.lng());
  }

  _setLatitudeAndLongitude(latitude, longitude) {
    document.getElementById('latitude').value = latitude;
    document.getElementById('longitude').value = longitude;

    this._latitude = latitude;
    this._longitude = longitude;
  }

  _setAutoCompleteFunctionality(map) {
    let input = document.createElement('INPUT');
    input.size = 30;    
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
    let autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.bindTo('bounds', map);
    let infowindow = new google.maps.InfoWindow();
    let marker = this._getMarker(map);

    this._updateWhenSearchChanges(map, marker, autocomplete, infowindow);
  }

  _getMarker(map) {
    let marker = new google.maps.Marker({
      map: map,
      draggable: true,      
      anchorPoint: new google.maps.Point(0, -29),
      animation:google.maps.Animation.BOUNCE,
    });

    return marker;
  }

  _updateWhenSearchChanges(map, marker, autocomplete, infowindow) {
    autocomplete.addListener('place_changed', () => {
      infowindow.close();
      marker.setVisible(false);
      let place = autocomplete.getPlace();
      if (!place.geometry) {
        alert(":::Location is not available.");
        return;
      }

      this._checkViewport(map, place);
      this._finalizeUpdate(map, marker, place);
    });
  }

  _checkViewport(map, place) {
    if (place.geometry.viewport) {
      map.fitBounds(place.geometry.viewport);
    } else {
      map.setCenter(place.geometry.location);
      map.setZoom(17);
    }
  }

  _finalizeUpdate(map, marker, place) {
    marker.setPosition(place.geometry.location);
    this._setMapActionListeners(map, marker);
    marker.setVisible(true);
    this._resetMap(map, marker);
  }

  _getDetailsFromCoordinates() {
    let coordinates = new google.maps.LatLng(this._latitude, this._longitude);
    let city = "";
    this._setGeocoder(city, coordinates);
  }

  _setGeocoder(city, coordinates) {
    this._geocoder.geocode({'latLng': coordinates}, (results, status) => {
      if (status == google.maps.GeocoderStatus.OK) {
        if (results[1]) {
          city = this._getDataAfterloopingThroughResults(results);          
          this._getGeneratedData(results, city);
        } else {
          this._showMessageElement(`:::No new results found`);
        }
      } else {
        this._showMessageElement(`:::Geocoder failure: ${status}`);
      }
    });
  }

  _showMessageElement(text) {
    this._$message.html(text);
    this._$message.show(1000);
  }

  _getDataAfterloopingThroughResults(results) {
    let city = "";
    for (let i = 0; i < results[0].address_components.length; i++) {
      for (let b = 0; b < results[0].address_components[i].types.length; b++) {
        if (results[0].address_components[i].types[b] == "administrative_area_level_1") {
          city = results[0].address_components[i];
          break;
        }
      }
    }

    return city;
  }

  _getGeneratedData(results, city) {
    $('#street-generated-preview').html(results[0].formatted_address);
    $('#area-generated-preview').html(city.long_name);
    $('#state-generated-preview').html(city.short_name.toUpperCase() || city.long_name.toUpperCase());
  }

  _doLoadStates(returnedObject) {
    const $state = $('#state');
    returnedObject.states.forEach((theObject, index) => {
      let $option = $('<option />', {
        'text': theObject,
        'value': theObject,
      });
      $state.append($option);
    });
  }

  _showPreview() {
    this._populateSuppliedPreview();
    this._populateGeneratedPreview();
    this._$inputArea.hide(1200);
    this._$result.show(1200);
  }

  _rePopulate() {
    this._$message.hide(1200);
    this._$mapObject.hide(1200);
    this._$next.hide(1200);
    this._$result.hide(1200);
    this._$send.show(1200);
    this._$formObject.show(1200);
    this._$inputArea.show(1200);
  }

  _populateSuppliedPreview() {
    $('#number-supplied-preview').html($('#number').val());
    $('#street-supplied-preview').html($('#street').val());
    $('#area-supplied-preview').html($('#area').val());
    $('#state-supplied-preview').html($('#state').val());
  }

  _populateGeneratedPreview() {
    this._getDetailsFromCoordinates();
    $('#number-generated-preview').html($('#number').val());
  }

  _back() {
    this._$message.hide(1200);
    this._$mapObject.show(1200);
    this._$next.show(1200);
    this._$result.hide(1200);
    this._$send.show(1200);
    this._$formObject.show(1200);
    this._$inputArea.show(1200);
  }
}

$(() => {
  new Geolocator();
}); 

