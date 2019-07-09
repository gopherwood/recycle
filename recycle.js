/* global console */
export default (function (Object, Array) {
    var populateArray = function () {
            var i = 0;

            for (i = 0; i < arguments.length; i++) {
                this.push(arguments[i]);
            }
        },
        recycleProp = {
            value: false,
            writable: true
        },
        caches = {},
        recycle = {
            createCache: function (ClassObject, name) {
                var cache = null,
                    o = null;

                if (!name) {
                    console.warn('Recycle: Must define a name for this cache.');
                    return null;
                } else if (caches[name]) {
                    if (ClassObject !== caches[name].ClassObject) {
                        console.warn('Recycle: There is already a cache named "' + name + '" that is being used for another object type.');
                    }
                    return caches[name];
                } else {
                    cache = caches[name] = {
                        ClassObject: ClassObject,
                        list: [],
                        objectConstructor: ClassObject
                    };

                    // Determine whether this is a class with constructor or a factory function.
                    if (ClassObject === Array) {
                        cache.objectConstructor = populateArray;
                    } else {
                        o = Object.create(ClassObject.prototype);
                        try {
                            ClassObject.apply(o);
                        } catch (e) {
                            cache.objectConstructor = ClassObject.constructor;
                        }
                    }
                    return cache;
                }
            },

            setUp: function (name) {
                var cache = caches[name],
                    newObject = null;

                if (!cache) {
                    console.warn('Recycle: No cache named "' + name + '" has been defined.');
                }

                if (cache.list.length) {
                    newObject = cache.list.pop();
                } else {
                    newObject = Object.create(cache.ClassObject.prototype);
                }

                cache.objectConstructor.apply(newObject, arguments);

                return newObject;
            },

            add: function (ClassObject, debug, name, recycle) {
                var isArray = (ClassObject === Array),
                    cache = this.createCache(ClassObject, name),
                    list = cache.list,
                    objectConstructor = cache.objectConstructor;
                
                Object.defineProperties(ClassObject, {
                    setUp: {
                        value: (debug ? function () {
                            var newObject = null;
                            
                            if (list.length) {
                                newObject = list.pop();
                                newObject.recycled = false;
                            } else {
                                newObject = Object.create(this.prototype);
                                Object.defineProperty(newObject, 'recycled', recycleProp);
                            }

                            objectConstructor.apply(newObject, arguments);

                            return newObject;
                        } : function () {
                            var newObject = null;
                            
                            if (list.length) {
                                newObject = list.pop();
                            } else {
                                newObject = Object.create(this.prototype);
                            }

                            objectConstructor.apply(newObject, arguments);

                            return newObject;
                        })
                    },
                    recycle: {
                        value: (debug ? function (instance) {
                            if (instance.recycled) {
                                console.warn('WHOA! I have already been recycled!', instance);
                            } else {
                                instance.recycled = true;
                                list.push(instance);
                            }
                        } : function (instance) {
                            list.push(instance);
                        })
                    }
                });
                Object.defineProperty(ClassObject.prototype, 'recycle', {
                    value: recycle || (isArray ? function (depth) {
                        var i = 0;
                        
                        if (depth > 1) {
                            i = this.length;
                            depth -= 1;
                            while (i--) {
                                this[i].recycle(depth);
                            }
                        }
                        this.length = 0;
                        ClassObject.recycle(this);
                    } : function () {
                        ClassObject.recycle(this);
                    })
                });
                
                return list;
            },
            cache: caches
        };

    return recycle;
}(Object, Array));