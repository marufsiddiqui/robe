var _ = require('lodash'),
  monk = require('monk'),
  Q = require('bluebird');


var utils = require('../testutils'),
  assert = utils.assert,
  expect = utils.expect,
  should = utils.should,
  sinon = utils.sinon;

var Robe = utils.Robe,
  Collection = Robe.Collection,
  Document = Robe.Document,
  RobeUtils = Robe.Utils;


var test = module.exports = {};



test['formatMongoDoc()'] = {
  'default': function*() {
    var collection = new Collection(123);

    var ret = RobeUtils.formatMongoDoc(collection, {
      name: 'Tim'
    });

    ret.should.be.instanceOf(Document);
  },

  'raw - local option': function*() {
    var collection = new Collection(123);

    var ret = RobeUtils.formatMongoDoc(collection, {
      name: 'Tim'
    }, {
      raw: true
    });

    ret.should.not.be.instanceOf(Document);

    ret.name.should.eql('Tim');
  },

  'raw - global option': function*() {
    var collection = new Collection(123, {
      raw: true
    });

    var ret = RobeUtils.formatMongoDoc(collection, {
      name: 'Tim'
    }, {
      raw: false
    });

    ret.should.not.be.instanceOf(Document);

    ret.name.should.eql('Tim');
  },
}

