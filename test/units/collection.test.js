var _ = require('lodash'),
  monk = require('monk'),
  Q = require('bluebird');


var utils = require('../testutils'),
  assert = utils.assert,
  expect = utils.expect,
  should = utils.should,
  sinon = utils.sinon;

var Robe = utils.Robe,
  Database = Robe.Database,
  Collection = Robe.Collection,
  Cursor = Robe.Cursor,
  Document = Robe.Document,
  RobeUtils = Robe.Utils;


var test = module.exports = {};


test.beforeEach = function(done) {
  var self = this;

  this._db = monk('127.0.0.1/robe-test');
  this.db = new Database(this._db);

  this._db.once('open', function(err) {
    if (err) return done(err);

    // drop test data
    Q.join(self._db.get('test').remove())
      .then(function() {
        // get collection
        self.collection = self.db.collection('test');
      })
      .done(done);
  });
};

test.afterEach = function(done) {
  this._db.close(done);
};



test['constructor'] = {
  'default': function*()  {
    this.collection.options.raw.should.be.false;

    _.deepGet(this.collection, 'collection.name').should.eql('test');

    _.deepGet(this.collection, 'collection.manager.driver').should.eql(
      _.deepGet(this._db, 'driver')
    );
  },

  'turn on RAW mode': function*() {
    this.collection = this.db.collection('test', {
      raw: true
    });

    this.collection.options.raw.should.be.true;
  }
};


test['insert'] = {
  'no schema': function*() {
    var attrs = {
      name: 'Jimmy'
    };

    var res = yield this.collection.insert(attrs);

    res.should.be.instanceOf(Document);

    res.name.should.eql('Jimmy');
    res._id.should.be.defined;
  },

  'schema - fail': function*() {
    var collection = this.db.collection('test', {
      schema: {
        name: {
          type: Number
        }
      }
    });

    try {
      yield collection.insert({
        name: 'Jimmy'
      });
  
      throw new Error('Unexpected');
    } catch (err) {
      err.toString().should.eql('Error: Validation failed');
    }
  },

  'calls formatMongoDoc()': function*() {
    var stub = this.mocker.stub(RobeUtils, 'formatMongoDoc', function() {
      return 123;
    });

    var attrs = {
      name: 'Jimmy'
    };

    var res = yield this.collection.insert(attrs, {
      raw: true
    });

    res.should.eql(123);

    var theCall = stub.getCall(0);
    _.deepGet(theCall, 'args.0').should.eql(this.collection);
    _.deepGet(theCall, 'args.1.name').should.eql('Jimmy');
    _.deepGet(theCall, 'args.2').should.eql({
      raw: true
    });
  },

  'hooks': function*() {
    var acc = [];

    this.collection.before('insert', function*(attrs, next) {
      acc.push(1);

      attrs.name += '-1';

      yield next;
    });

    this.collection.before('insert', function*(attrs, next) {
      acc.push(2);

      attrs.name += '-2';

      yield next;
    });

    this.collection.after('insert', function*(result, next) {
      acc.push(3);

      result.one = result._id;

      yield next;
    });

    this.collection.after('insert', function*(result, next) {
      acc.push(4);

      result.two = result._id;

      yield next;
    });

    var attrs = {
      name: 'Jimmy'
    };

    var res = yield this.collection.insert(attrs);

    acc.should.eql([1,2,3,4]);

    res.one.should.eql(res._id);
    res.two.should.eql(res._id);

    res.name.should.eql('Jimmy-1-2');
  },

  'schema validation runs after hooks': function*() {
    var collection = this.db.collection('test', {
      schema: {
        name: {
          type: String
        }
      }
    });

    collection.before('insert', function*(attrs, next) {
      attrs.name = 12;

      yield next;
    });

    try {
      yield collection.insert({
        name: 'john'
      });
    
      throw new Error('Unexpected');
    } catch (err) {
      err.toString().should.eql('Error: Validation failed');
      err.failures[0].should.eql('/name: must be a string');
    }
  },

};





test['update'] = {
  beforeEach: function*() {
    var data = [
      {
        name: 'Jimmy',
        dead: true        
      },
      {
        name: 'Mark',
        dead: false        
      },
      {
        name: 'Tom',
        dead: false        
      },
      {
        name: 'Doug',
        dead: true        
      },
      {
        name: 'Amanda',
        dead: true        
      },
    ];

    for (var i=0; i<data.length; ++i) {
      yield this.collection.insert(data[i]);
    }
  },
  'no schema': function*() {
    var attrs = {
      name: 'Jimmy'
    };

    var res = yield this.collection.update({
      name: 'Tom'
    }, {
      name: 'Phil'
    });

    res.should.eql(1);

    var doc = yield this.collection.findOne({
      name: 'Phil'
    });

    doc.should.be.defined;
  },
  'schema - fail': function*() {
    var collection = this.db.collection('test', {
      schema: {
        name: {
          type: Number
        }
      }
    });

    try {
      yield collection.update({
        name: 'Tom'
      }, {
        $set: {
          name: 'Phil'
        }
      });
  
      throw new Error('Unexpected');
    } catch (err) {
      err.toString().should.eql('Error: Validation failed');
    }
  },
  'hooks': function*() {
    var acc = [];

    this.collection.before('update', function*(search, update, next) {
      acc.push(1);

      search.name = 'Amanda';

      yield next;
    });

    this.collection.before('update', function*(search, update, next) {
      acc.push(2);

      update.$set.dead = 123;

      yield next;
    });

    this.collection.after('update', function*(search, update, ret, next) {
      acc.push(3);

      search.result1 = ret;

      yield next;
    });

    this.collection.after('update', function*(search, update, ret, next) {
      acc.push(4);

      search.result2 = ret;

      yield next;
    });

    var search = {
      name: 'Tom'
    };

    var res = yield this.collection.update(search, {
      $set: {
        name: 'Phil'
      }
    });

    acc.should.eql([1,2,3,4]);

    var doc = yield this.collection.findOne({
      name: 'Phil'
    });

    doc.dead.should.eql(123);

    search.result1.should.eql(res);
    search.result2.should.eql(res);
  },
  'schema validation runs after hooks': function*() {
    var collection = this.db.collection('test', {
      schema: {
        name: {
          type: String
        }
      }
    });

    collection.before('update', function*(search, update, next) {
      update.$set.name = 12;

      yield next;
    });

    try {
      yield collection.update({
        name: 23
      }, {
        $set: {
          name: 'Phil'
        }
      });
    
      throw new Error('Unexpected');
    } catch (err) {
      err.toString().should.eql('Error: Validation failed');
      err.failures[0].should.eql('/name: must be a string');
    }
  },
};





test['remove'] = {
  beforeEach: function*() {
    var data = [
      {
        name: 'Jimmy',
        dead: true        
      },
      {
        name: 'Mark',
        dead: false        
      },
      {
        name: 'Tom',
        dead: false        
      },
      {
        name: 'Doug',
        dead: true        
      },
      {
        name: 'Amanda',
        dead: true        
      },
    ];

    for (var i=0; i<data.length; ++i) {
      yield this.collection.insert(data[i]);
    }
  },
  'removes': function*() {
    var res = yield this.collection.remove({
      dead: true
    });

    var results = yield this.collection.find();

    results.length.should.eql(2);
    _.pluck(results, 'name').should.eql(['Mark', 'Tom']);
  },
  'hooks': function*() {
    var acc = [];

    this.collection.before('remove', function*(search, next) {
      acc.push(1);

      search.name = 'Mark';

      yield next;
    });

    this.collection.before('remove', function*(search, next) {
      acc.push(2);

      search.dead = false;

      yield next;
    });

    this.collection.after('remove', function*(search, ret, next) {
      acc.push(3);

      yield next;
    });

    this.collection.after('remove', function*(search, ret, next) {
      acc.push(4);

      yield next;
    });

    var search = {
      name: 'Tom'
    };

    var res = yield this.collection.remove({
      dead: true
    });

    acc.should.eql([1,2,3,4]);

    var results = yield this.collection.find();

    results.length.should.eql(4);
    _.pluck(results, 'name').should.eql(['Jimmy', 'Tom', 'Doug', 'Amanda']);
  },
};





test['find'] = {
  beforeEach: function*() {
    var data = [
      {
        name: 'Jimmy',
        dead: true        
      },
      {
        name: 'Mark',
        dead: false        
      },
      {
        name: 'Tom',
        dead: false        
      },
      {
        name: 'Doug',
        dead: true        
      },
      {
        name: 'Amanda',
        dead: true        
      },
    ];

    for (var i=0; i<data.length; ++i) {
      yield this.collection.insert(data[i]);
    }
  },

  'no params': function*() {
    var res = yield this.collection.find();

    res.length.should.eql(5);
    _.pluck(res, 'name').should.eql(['Jimmy', 'Mark', 'Tom', 'Doug', 'Amanda']);
    (5 === _.pluck(res, 'id').length).should.be.true;
  },

  'calls formatMongoDoc()': function*() {
    var stub = this.mocker.stub(RobeUtils, 'formatMongoDoc', function() {
      return 123;
    });

    var attrs = {
      name: 'Jimmy'
    };

    var res = yield this.collection.find({}, {
      raw: true
    });

    res.should.eql([123, 123, 123, 123, 123]);

    stub.callCount.should.eql(5);
    var theCall = stub.getCall(0);
    _.deepGet(theCall, 'args.0').should.eql(this.collection);
    _.deepGet(theCall, 'args.2').should.eql({
      raw: true
    });
  },

  'filter - found': function*() {
    var res = yield this.collection.find({
      dead: true
    });

    res.length.should.eql(3);
    _.pluck(res, 'name').should.eql(['Jimmy', 'Doug', 'Amanda']);
    (3 === _.pluck(res, 'id').length).should.be.true;
  },


  'filter - not found': function*() {
    var res = yield this.collection.find({
      dead: 123
    });

    res.length.should.eql(0);
  },


  'filter - sort': function*() {
    var res = yield this.collection.find({
    }, {
      sort: {
        dead: 1,
        name: 1,
      }
    });

    res.length.should.eql(5);
    _.pluck(res, 'name').should.eql(['Mark', 'Tom', 'Amanda', 'Doug', 'Jimmy']);
    _.pluck(res, 'dead').should.eql([false, false, true, true, true]);
  },

  'filter - limit': function*() {
    var res = yield this.collection.find({
      dead: true
    }, {
      sort: {
        name: 1
      },
      limit: 1,
    });

    res.length.should.eql(1);
    _.pluck(res, 'name').should.eql(['Amanda']);
    _.pluck(res, 'dead').should.eql([true]);
  },

  'filter - skip': function*() {
    var res = yield this.collection.find({
      dead: true
    }, {
      sort: {
        name: 1
      },
      skip: 1,
      limit: 1,
    });

    res.length.should.eql(1);
    _.pluck(res, 'name').should.eql(['Doug']);
    _.pluck(res, 'dead').should.eql([true]);
  },

  'filter - fields': function*() {
    var res = yield this.collection.find({
      dead: true
    }, {
      fields: {
        name: 1,
      },
      limit: 1,
    });

    res.length.should.eql(1);
    _.pluck(res, 'name').should.eql(['Jimmy']);
    _.pluck(res, 'dead').should.eql([undefined]);
  },

  'findOne()': {
    'calls formatMongoDoc()': function*() {
      var stub = this.mocker.stub(RobeUtils, 'formatMongoDoc', function() {
        return 123;
      });

      var attrs = {
        name: 'Jimmy'
      };

      var res = yield this.collection.findOne({
        dead: true
      }, {
        sort: {
          name: 1
        },
        raw: true
      });

      res.should.eql(123);

      stub.callCount.should.eql(1);
      
      var theCall = stub.getCall(0);

      _.deepGet(theCall, 'args.0').should.eql(this.collection);
      _.deepGet(theCall, 'args.2.raw').should.be.true;
    },
    'found': function*() {
      var res = yield this.collection.findOne({
        dead: true
      }, {
        sort: {
          name: 1
        }
      });

      res.name.should.eql('Amanda');
    },
    'not found - null': function*() {
      var res = yield this.collection.findOne({
        name: 'abc'
      });

      expect(res).to.be.null;
    }
  },
  'findStream': function*() {
    var cursor = yield this.collection.findStream({
      name: 'John'
    }, {
      raw: true,
    });

    cursor.should.be.instanceOf(Cursor);
  }
};




