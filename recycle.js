/* global console */
export default (function (Object, Array) {
    var recycleProp = {
            value: false,
            writable: true
        },
        caches = {},
        container = function () {
            this.contains = null;
            this.previous = null;
        },
        containers = null, // link-list of cached, unused containers for caches.
        recycle = {
            add: function (ClassObject, name, setUp, recycle, mixinMethods, debug) {
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
                            available = Object.create(container.prototype);
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
                if (recycle) {
                    cache.recycle = function (item, ...args) {
                        recycle.apply(item, ...args);
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

                if (mixinMethods) {
                    Object.defineProperties(ClassObject, {
                        setUp: {
                            value: (debug ? function () {
                                var newObject = cache.setUp.apply(cache, arguments);
    
                                if (typeof newObject.recycled === 'undefined') {
                                    Object.defineProperty(newObject, 'recycled', recycleProp);
                                } else {
                                    newObject.recycled = false;
                                }
        
                                return newObject;
                            } : cache.setUp.bind(cache))
                        },
                        recycle: {
                            value: (debug ? function (instance, ...args) {
                                if (instance.recycled) {
                                    console.warn('WHOA! I have already been recycled!', instance);
                                } else {
                                    instance.recycled = true;
                                    cache.recycle(instance, ...args);
                                }
                            } : cache.recycle.bind(cache))
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

    return recycle;
}(Object, Array));