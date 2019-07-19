/* global Array, console, Object */

const recycleProp = {
        value: false,
        writable: true
    },
    caches = {},
    Container = function () {
        this.contains = null;
        this.previous = null;
    };
    
let containers = null; // link-list of cached, unused containers for caches.

export default {
    add: function (ClassObject, name, setUp, tearDown, mixinMethods, debug) {
        var isArray = (ClassObject === Array),
            cache = null;

        if (!name) {
            console.warn('Recycle: Must define a name for this cache.');
            return null;
        }
        
        if (caches[name]) {
            if (ClassObject !== caches[name].ClassObject) {
                console.warn('Recycle: There is already a cache named "' + name + '" that is being used for another object type.');
            }
            return caches[name];
        }
        
        cache = caches[name] = {
            ClassObject: ClassObject,
            list: null,
            setUp: null,
            recycle: null,
            pop: isArray ? function () {
                var list = this.list,
                    item = null;

                if (list) {
                    this.list = list.previous;
                    item = list.contains;
                    list.previous = containers;
                    containers = list;
                    return item;
                } else {
                    return [];
                }
            } : function () {
                var list = this.list,
                    item = null;

                if (list) {
                    this.list = list.previous;
                    item = list.contains;
                    list.previous = containers;
                    containers = list;
                    return item;
                } else {
                    return Object.create(this.ClassObject.prototype);
                }
            },
            push: function (item) {
                var available = containers;

                if (available) {
                    containers = available.previous;
                } else {
                    available = Object.create(Container.prototype);
                }

                available.previous = this.list;
                this.list = available;
                available.contains = item;
            },
            getLength: function () {
                var i = 0,
                    item = this.list;

                while (item) {
                    i += 1;
                    item = item.previous;
                }

                return i;
            }
        };

        // Handle object instantiation
        if (setUp) {
            cache.setUp = function () {
                var newObject = this.pop();

                setUp.apply(newObject, arguments);

                return newObject;
            };
        } else if (isArray) {
            cache.setUp = function () {
                var arr = this.pop(),
                    i = 0;
        
                for (i = 0; i < arguments.length; i++) {
                    arr[i] = arguments[i];
                }

                return arr;
            };
        } else {
            cache.setUp = cache.pop;
        }

        // Handle object release
        if (tearDown) {
            cache.recycle = function (item, ...args) {
                tearDown.apply(item, ...args);
                this.push(item);
            };
        } else if (isArray) {
            cache.recycle = function (arr, depth) {
                var i = 0;
                
                if (depth > 1) {
                    i = arr.length;
                    depth -= 1;
                    while (i--) {
                        this.recycle(arr[i], depth);
                    }
                }
                arr.length = 0;
                this.push(arr);
            };
        } else {
            cache.recycle = cache.push;
        }

        // Add debug wrapper if needed
        if (debug) {
            cache.setUp = function (cacheSetUp, ...args) {
                var newObject = cacheSetUp(...args);

                if (typeof newObject.recycled === 'undefined') {
                    Object.defineProperty(newObject, 'recycled', recycleProp);
                } else {
                    newObject.recycled = false;
                }

                return newObject;
            }.bind(cache, cache.setUp.bind(cache));

            cache.recycle = function (recycle, instance, ...args) {
                if (instance.recycled) {
                    console.warn('Recycle: WHOA! I have already been recycled!', instance);
                } else {
                    instance.recycled = true;
                    recycle(instance, ...args);
                }
            }.bind(cache, cache.recycle.bind(cache));

            if (isArray) {
                cache.recycle = function (recycle, instance, ...args) {
                    if (!Array.isArray(instance)) {
                        console.warn('Recycle: Adding a non-Array to the array cache!');
                    }
                    recycle(instance, ...args);
                }.bind(cache, cache.recycle.bind(cache));
            }
        }

        if (mixinMethods) {
            Object.defineProperties(ClassObject, {
                setUp: {
                    value: cache.setUp.bind(cache)
                },
                recycle: {
                    value: cache.recycle.bind(cache)
                }
            });
            Object.defineProperty(ClassObject.prototype, 'recycle', {
                value: function (...args) {
                    cache.recycle(this, ...args);
                }
            });
        }

        return cache;
    },

    setUp: function (name, ...args) {
        var cache = caches[name];

        if (!cache) {
            console.warn('Recycle: No cache named "' + name + '" has been defined.');
            return null;
        }

        return cache.setUp(...args);
    },

    recycle: function (name, item, ...args) {
        var cache = caches[name];

        if (!cache) {
            console.warn('Recycle: No cache named "' + name + '" has been defined.');
            return;
        }

        cache.recycle(item, ...args);
    },

    cache: caches
};
