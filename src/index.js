!(function(){

    /**
     * 不想依赖太多库，所以直接用这个简单的模板
     * Simple JavaScript Templating
     * John Resig - http://ejohn.org/ - MIT Licensed
     */
    var Template = (function(){
        var cache = {};

        return function tmpl(str, data){
            // Figure out if we're getting a template, or if we need to
            // load the template - and be sure to cache the result.
            var fn = !/\W/.test(str) ?
                cache[str] = cache[str] ||
                    tmpl(document.getElementById(str).innerHTML) :

                // Generate a reusable function that will serve as a template
                // generator (and which will be cached).
                new Function("obj",
                    "var p=[],print=function(){p.push.apply(p,arguments);};" +

                        // Introduce the data as local variables using with(){}
                        "with(obj){p.push('" +

                        // Convert the template into pure JavaScript
                        str
                            .replace(/[\r\t\n]/g, " ")
                            .split("<%").join("\t")
                            .replace(/((^|%>)[^\t]*)'/g, "$1\r")
                            .replace(/\t=(.*?)%>/g, "',$1,'")
                            .split("\t").join("');")
                            .split("%>").join("p.push('")
                            .split("\r").join("\\'")
                        + "');}return p.join('');");

            // Provide some basic currying to the user
            return data ? fn( data ) : fn;
        };
    })();


    /**
     * 判断当前JS环境
     */
    var hasDefine = typeof define === 'function';
    var hasExports = typeof module !== 'undefined' && module.exports;

    /**
     * 文档相关的HTML模板
     */
    var HTML_TPLS = {
        doc: '\
            <div class="json-schema-doc">\
            <%=content%>\
            <script>\
            \
            </script>\
            </div>\
        ',

        /**
         * 其中 interactive 用来区分模板是否需要支持交互，若需要，则会再渲染出一些钩子出来
         */
        schemaBlock: '\
            <div class="schema-block schema-block-<%=type%> \
            <% if( isRoot || !interactive ){ %> unfold <% } %>\
            <% if( external ){ %>external<% } %>">\
                <div class="summary\
                <% if( !isRoot && interactive && ( ( description && description.length > 20 ) || constraint || children ) ){ %> \
                schema-detail-trigger J_SchemaDetailTrigger\
                <% } %>\
                ">\
                    <% if( name ){ %><span class="name"><%=name%></span><% } %>\
                    <span class="type"><%=type%></span>\
                    <% if( required ){ %><span class="required">（必要）</span><% } %>\
                    <% if( external ){ %><span class="external">（外部引用，<a target="_blank" href="<%=externalURL%>"><% if(externalName){ %><%=externalName%><% } else {%>查看<% } %></a>）</span><% } %>\
                    <span class="desc"><%=description%></span>\
                </div>\
                <div class="detail">\
                    <% if( description && description.length > 20 ){ %>\
                    <div class="description">\
                        <%=(description.replace( /\\n/g, "<br>" ))%>\
                    </div>\
                    <% } %>\
                    <% if( constraint ){ %>\
                    <ul class="constraint">\
                        <%=constraint%>\
                    </ul>\
                    <% } %>\
                    <% if(children){ %>\
                    <ul class="children">\
                        <%=children%>\
                    </ul>\
                    <% } %>\
                </div>\
            </div>',
        constraint: '\
            <% if( list ) for( var item, i = 0; i < list.length; i++){ item = list[ i ]; %>\
            <li <% if( item.block ){ %> class="constraint-block" <% } %> >\
                <div class="field"><%=item.field%></div>\
                <div class="value"><%=item.value%></div>\
            </li>\
            <% } %>',
        children: '\
            <% if( list ) for( var item, i = 0; i < list.length; i++){ item = list[ i ];%>\
            <li>\
                <%=item%>\
            </li>\
            <% } %>'
    };

    /**
     * 根据给定的Schema，生成对应的HTML
     * @param {Object} schema
     * @param {Object} [options]
     * @param {Object} options.refs { path: schema }
     * @return {String} HTML结构
     */
    var Generator = function( schema, options ){
        options = options || {};
        // 默认以 title 作为name，没有就只有描述
        return Template( HTML_TPLS.doc, {
            content: Generator._generator( schema.title, schema, schema, options )
        });
    };

    /**
     * 若需要交互功能，则用户可以自带jQuery，然后调用这个方法
     * @param schema
     * @param options
     * @param {ELEMENT} target
     * @returns {*}
     */
    Generator.buildWithJQ = function( schema, options, target ){

        if( typeof jQuery === 'undefined' ){
            throw new Error( 'buildWithJQ 方法依赖jQuery' );
        }
        else {

            options = options || {};
            options.interactive = true;

            var HTML = Generator.apply( this, arguments );

            var dom = $( HTML );

            dom.delegate( '.J_SchemaDetailTrigger', 'click', function( e ){
                var trigger = $( e.currentTarget );
                trigger.parent().toggleClass( 'unfold' );
            });

            if( target ){
                $( target ).append( dom );
            }

            return dom[0];
        }
    };

    Generator._generator = function( name, schema, wholeScheme, options ){

        var constraint = [];
        var index;
        var item;
        var cons = [];
        var external = false;
        var externalURL = null;
        var externalName = null;

        // 先检查是否有 $ref
        if( schema.$ref ){

            var ret = /^#\/definitions\/(.+)$/.exec( schema.$ref );
            if( ret && ret[1] && wholeScheme.definitions && wholeScheme.definitions[ ret[1] ]){
                schema = wholeScheme.definitions[ ret[1] ];
            }
            // 若在本地找不到（可能是网络请求或者写错了）
            else if( options.refs && options.refs[ schema.$ref ] ){
                debugger;
                external = true;
                externalURL = schema.$ref;
                // 查找配置中是否给定了
                schema = options.refs[ schema.$ref ];
                externalName = schema.title;
            }
            else {
                external = true;
                externalURL = schema.$ref;
            }
        }



        /**
         * 构建通用约束
         * enum
         * default
         * format
         * allOf
         * anyOf
         * oneOf
         * not
         */

        // todo 枚举暂时只支持数字和字符串
        if( schema.enum ){
            constraint.push( { field: '枚举值:', value: '<code>' + schema.enum.join( '</code><code>' ) + '</code>' });
        }

        if( schema.default ){
            constraint.push( { field: '默认值:', value: '<code>' + schema.default + '</code>' });
        }

        if( schema.format ){
            constraint.push( { field: '格式规范:', value: '<code>' + schema.format + '</code>' });
        }

        if( schema.allOf && schema.allOf.length ){

            cons = [];

            for( index = 0; index < schema.allOf.length; index++ ){
                item = schema.allOf[ index ];
                cons.push( this._generator( '约束' + ( index + 1 ), item, wholeScheme, options ));
            }

            constraint.push( { field: '需要满足所有约束:', value: cons.join( ' ' ), block: true });
        }

        if( schema.oneOf && schema.oneOf.length ){

            cons = [];

            for( index = 0; index < schema.oneOf.length; index++ ){
                item = schema.oneOf[ index ];
                cons.push( this._generator( '约束' + ( index + 1 ), item, wholeScheme, options ));
            }

            constraint.push( { field: '需要满足其中的某个约束:', value: cons.join( ' ' ), block: true });
        }

        if( schema.anyOf && schema.anyOf.length ){

            cons = [];

            for( index = 0; index < schema.anyOf.length; index++ ){
                item = schema.anyOf[ index ];
                cons.push( this._generator( '约束' + ( index + 1 ), item, wholeScheme, options ));
            }

            constraint.push( { field: '需要满足其中任意个约束:', value: cons.join( ' ' ), block: true });
        }

        if( schema.not ){
            constraint.push( { field: '不应该满足该约束:',
                value: cons.push( this._generator( '约束', schema.not, wholeScheme, options )), block: true
            });
        }

        /**
         * 根据不同的类型，执行generator
         */
        var subGeneratorName = '_' + schema.type + 'Generator';

        if( this[ subGeneratorName ] ){
            var subRet = this[ subGeneratorName ]( schema, wholeScheme, options );
            constraint = constraint.concat( subRet.constraint || [] );

            // 渲染子属性
            var childrenStr = Template( HTML_TPLS.children, { list: subRet.children } );
        }

        /**
         * 进行HTML构建
         */

        // 渲染约束
        var constraintStr = Template( HTML_TPLS.constraint, { list: constraint } );

        // 渲染用的数据
        var renderData = {
            name: name || schema.title,
            type: schema.type,
            description: schema.description,
            constraint: constraintStr ? constraintStr.replace( /\s*/, '' ) : constraintStr,
            children: childrenStr ? childrenStr.replace( /\s*/, '' ) : childrenStr,
            isRoot: schema === wholeScheme,
            required: schema.required,
            interactive: options.interactive,
            external: external,
            externalURL: externalURL,
            externalName: externalName
        };

        // 进行block的渲染
        return Template( HTML_TPLS.schemaBlock, renderData );
    };

    /**
     * Object 对象genenrator
     * @param schema
     * @param wholeScheme
     * @param options
     * @private
     */
    Generator._objectGenerator = function( schema, wholeScheme, options ){

        var constraint = [];
        var children = [];
        var con = null;
        var key;
        var value;

        /**
         * 先查找约束
         */

        // dependences
        if( schema.dependences ){
            for( key in schema.dependences ){
                value = schema.dependences[ key ];

                if( value ){
                    con = {};
                    con.field = '若包含字段 “' + key + '” 则:';

                    // 是否为数组，简单检查
                    if( value.length && value[0] ){
                        con.value = '必须同时包含属性: ' + value.join( ', ' );
                    }
                    // 若为对象
                    else {
                        con.value = this._generator( '还需要满足:', value, wholeScheme, options );
                    }

                    constraint.push( con );
                }
            }
        }

        // minProperties
        if( schema.minProperties >= 0 ){
            constraint.push( { field: '最少包含属性值数量:', value: schema.minProperties } );
        }

        // maxProperties
        if( schema.maxProperties >= 0 ){
            constraint.push( { field: '最多包含属性值数量:', value: schema.maxProperties } );
        }

        /**
         * 计算子属性
         */

        // properties
        if( schema.properties ){
            for( key in schema.properties ){

                // 添加required
                if( schema.required && schema.required.length > 0 && schema.properties[ key ] && schema.required.indexOf( key ) >= 0 ){
                    schema.properties[ key ].required = true;
                }

                children.push( this._generator( key, schema.properties[ key ], wholeScheme, options ) );
            }
        }

        // patternProperties
        if( schema.patternProperties ){
            for( key in schema.patternProperties ){
                children.push( this._generator( key, schema.patternProperties[ key ], wholeScheme, options ) );
            }
        }

        // additionalProperties
        if( schema.additionalProperties ){
            children.push( this._generator( '所有额外的属性', schema.additionalProperties, wholeScheme, options ) );
        }

        return {
            constraint: constraint,
            children: children
        };
    };

    /**
     * 数组类型 generator
     * @param schema
     * @param wholeScheme
     * @param options
     * @private
     */
    Generator._arrayGenerator = function( schema, wholeScheme, options ){

        var constraint = [];
        var children = [];
        var index;
        var item;

        /**
         * 先计算约束
         */
        if( schema.maxItems >= 0 || schema.minItems >= 0 ){

            constraint.push( { field: '列表长度:',
                value: ( schema.maxItems >= 0 ? ' 小于等于' + schema.maxItems : ' ' )
                + ( schema.minItems >= 0 ? ' 大于等于' + schema.minItems : '' )
            });
        }

        if( schema.uniqueItems ){
            constraint.push( { field: '数组成员需要唯一' } );
        }

        /**
         * 计算 children
         */

        // items
        if( schema.items ){

            // 若为数组
            if( schema.items.length && schema.items[ 0 ] ){

                for( index = 0; index < schema.items.length; index++ ){
                    item = schema.items[ index ];
                    children.push( this._generator( '[' + index + '] ', item, wholeScheme, options ) );
                }
            }
            else {
                children.push( this._generator( '[n] ', schema.items, wholeScheme, options ) );
            }
        }

        // additionalItems
        if( schema.additionalItems ){
            children.push( this._generator( '额外的成员', schema.additionalItems, wholeScheme, options ) );
        }

        return {
            constraint: constraint,
            children: children
        };
    };

    Generator._stringGenerator = function( schema, wholeScheme, options ){

        var constraint = [];

        /**
         * 计算约束
         */

        // pattern
        if( schema.pattern ){
            constraint.push( { field: '需要遵循正则:', value: schema.pattern } );
        }

        // maxLength minLength
        if( schema.maxLength >= 0 || schema.minLength >= 0 ){

            constraint.push( { field: '字符串长度:',
                value: ( schema.maxLength >= 0 ? ' 小于等于' + schema.maxLength : ' ' )
                    + ( schema.minLength >= 0 ? ' 大于等于' + schema.minLength : '' )
            });
        }

        return {
            constraint: constraint
        };
    };

    Generator._numberGenerator = function( schema, wholeScheme, options ){

        var constraint = [];

        /**
         * 计算约束
         */
        if( schema.multipleOf ){
            constraint.push( { field: '必须为' + schema.multipleOf + '的倍数' } );
        }

        if( schema.maximum !== undefined || schema.minimum !== undefined ){

            constraint.push( { field: '数值大小:',
                value: ( schema.maximum !== undefined ? ( ' 小于' + ( schema.exclusiveMaximum ? '等于' : '' ) + schema.maximum ) : ' ' )
                    + ( schema.minimum !== undefined ? ( ' 大于' + ( schema.exclusiveMinimum ? '等于' : '' ) + schema.minimum ) : '' )
            });
        }

        return {
            constraint: constraint
        };
    };

    Generator._integerGenerator = function( schema, wholeScheme, options ){
        return this._numberGenerator( schema, options );
    };

    Generator._booleanGenerator = function( schema, wholeScheme, options ){
        return {};
    };

    Generator._nullGenerator = function( schema, wholeScheme, options ){
        return {};
    };


    /**
     * 根据不同的JS环境输出内容
     */

    if( hasExports ){
        module.exports = Generator;
    }
    else if( hasDefine ){
        define(function(){
            return Generator;
        });
    }
    else {
        this.JsonSchemaDocGenerator = Generator;
    }

})();