frappe.ui.form.on('BOM', {
    setup: function(frm) {
        frm.set_query("g_item", function() {
			return {
				filters: [
					["Item","item_group", "=", "Generic Sellable Items"]
				]
			}
        });
    },
    refresh: function(frm){
        if(frm.doc.type == 'General'){
            frm.set_query("item", function() {
                return {
                    filters: [
                        ["Item","item_group", "=", "Generic Sellable Items"]
                    ]
                }
            });
            frm.fields_dict['items'].grid.get_field('item_code').get_query = function(doc, cdt, cdn) {
                var child = locals[cdt][cdn];
                //console.log(child);
                return {    
                    filters:[
                        ['item_group', 'in', ['Generic Items','Services']]
                    ]
                }
            }
            frm.refresh_field("items");
        }
        else{
            frm.set_query("item", function() {
                return {
                    filters: [
                        ["Item","item_group", "=", "Project Sellable Items"]
                    ]
                }
            });
            frm.fields_dict['items'].grid.get_field('item_code').get_query = function(doc, cdt, cdn) {
                var child = locals[cdt][cdn];
                //console.log(child);
                return {    
                    filters:[
                        ['item_group', '!=', 'Generic Items']
                    ]
                }
            }
            frm.refresh_field("items");
        }
    },
    before_load: function(frm){
        //location.reload();
    },
    onload: function(frm,cdt,cdn){
        if(!cur_frm.doc.__islocal)
        {
            var g_item = frappe.meta.get_docfield("BOM","g_item", cur_frm.doc.name);
            g_item.read_only = 1;
            frm.refresh_field("g_item");
        }
        if(frm.doc.type == 'Project'){
            var qty = frappe.meta.get_docfield("BOM Item","qty", cur_frm.doc.name);
            var uom = frappe.meta.get_docfield("BOM Item","uom", cur_frm.doc.name);
            var rate = frappe.meta.get_docfield("BOM Item","rate", cur_frm.doc.name);
            var amount = frappe.meta.get_docfield("BOM Item","amount", cur_frm.doc.name);
            var g_item_code = frappe.meta.get_docfield("BOM Item","g_item_code", cur_frm.doc.name);
            qty.in_list_view = 0;
            uom.in_list_view = 0;
            rate.in_list_view = 0;
            amount.in_list_view = 0;
            g_item_code.in_list_view = 1;
            frm.refresh_field("items"); 
        }  
        else{
            var qty = frappe.meta.get_docfield("BOM Item","qty", cur_frm.doc.name);
            var uom = frappe.meta.get_docfield("BOM Item","uom", cur_frm.doc.name);
            var rate = frappe.meta.get_docfield("BOM Item","rate", cur_frm.doc.name);
            var amount = frappe.meta.get_docfield("BOM Item","amount", cur_frm.doc.name);
            var g_item_code = frappe.meta.get_docfield("BOM Item","g_item_code", cur_frm.doc.name);
            qty.in_list_view = 1;
            uom.in_list_view = 1;
            rate.in_list_view = 1;
            amount.in_list_view = 1;
            g_item_code.in_list_view = 0;
            frm.refresh_field("items"); 
        }  
    },
    before_submit: function(frm){
        if(!frm.doc.project_discount && frm.doc.docstatus == '0'){
            //set product discount name 
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    'doctype': 'Project Discount',
                    'filters': {
                        'project': frm.doc.project,
                        'is_active': 1
                    },
                    'fieldname': [
                        'name'
                    ]                   
                },
                callback: function(n){
                    if(!n.exc){
                        frm.set_value("project_discount",n.message.name);
                    }
                }
            })
            }
    },
    before_save: function(frm){
        if(frm.doc.type == 'Project'){
            frappe.call({
                method: 'frappe.client.get_value',
                args:{
                    'doctype':'BOM',
                    'filters':{
                        'name': frm.doc.g_bom
                    },
                    'fieldname':['total_cost']
                },
                callback:function(r){
                    if (!r.exc) {
                        if(frm.doc.total_cost_with_discount > r.message.total_cost){
                            msgprint('Bom Is exceeds the total cost of genric bom');
                            frappe.validated = false;
                            /*frappe.confirm('Cost Exceeds Generic Bom Cost, Do you want to Continue ?',
                            () => {
                                    // action to perform if Yes is selected
                            }, () => {
                             // action to perform if No is selected
                              frappe.validated = false;
                            })*/
                            
                        }
                    }
                }
            });
        }
    },
    validate: function(frm) {
        var total_discount_rate = 0;
        var total_cost_with_discount = 0;
        var material_cost = 0;
        var activity_cost = 0;
        //calculate cost(material) and cost(activity)
        $.each(frm.doc.items || [], function(i, s) {
            frappe.call({
                method: 'frappe.client.get_value',
                args:{
                    'doctype':'Item',
                    'filters':{
                        'name': s.item_code
                    },
                    'fieldname':['is_stock_item']
                },
                callback:function(r){
                    if (!r.exc) {
                        if(r.message.is_stock_item == 1){
                            material_cost += flt(s.amount);
                            frm.set_value("stock_material_cost",material_cost);
                        }
                        else{
                            activity_cost += flt(s.amount);
                            frm.set_value("activity_material_cost",activity_cost);
                        }
                    }
                }
            });
        });
        if(frm.doc.type == 'Project' && frm.doc.item){
            if(frm.doc.project_name == null || frm.doc.g_item == null){
                frappe.msgprint({
                    title: __('Field Missing'),
                    indicator: 'red',
                    message: __('please select project and generic sellable item.')
                });
                validated = false;
            }
        }
        // Add discount percentage and rate for BOM Item based on project discount table
        if(frm.doc.project)
        {      
            $.each(frm.doc.bom_discount_detial || [], function(i, d) {
                total_cost_with_discount = 0;
                $.each(frm.doc.items || [], function(i, v) {
                    frappe.call({
                        method: 'frappe.client.get_value',
                        args: {
                            'doctype': 'Item',
                            'filters': {'name': v.item_code},
                            'fieldname': [
                                'item_group'
                            ]
                        },
                        callback: function(s) {
                            if (!s.exc) {
                                var discount_rate = 0;
                                if(d.item_group == s.message.item_group){
                                    discount_rate = flt(v.amount)*(flt(d.discount_percentage)/100);
                                    total_discount_rate += flt(discount_rate);
                                    //total_cost_with_discount += (flt(v.amount)+flt(discount_rate));
                                    frm.set_value("total_discount",total_discount_rate);
                                    //frm.set_value("total_cost_with_discount",total_cost_with_discount);
                                    frappe.model.set_value(v.doctype, v.name,"discount_percentage",d.discount_percentage)
                                    frappe.model.set_value(v.doctype, v.name,"discount_rate",discount_rate)
                                }
                                //calculate total cost with margin
                                total_cost_with_discount += (flt(v.amount)+flt(discount_rate));
                                frm.set_value("total_cost_with_discount",total_cost_with_discount);

                           }
                        }
                    })
                });
            });
        }
        else
        {
            if(frm.doc.type == 'Project')
            {
                frappe.msgprint({
                    title: __('Field Missing'),
                    indicator: 'red',
                    message: __('Please Select the Project')
                });
                validated = false;
            }           
        }
    },
    type: function(frm){
        if(frm.doc.type == 'General'){
           // if(frm.doc.project)
           // {
                frm.set_value("project",null);
                frm.set_value("project_name",null);
                frm.set_value("g_bom",null);
                frm.set_value("g_item",null);
                frm.set_value("item",null);
                frm.clear_table("items");
                frm.clear_table("bom_discount_detial");
                frm.refresh_field("project");
                frm.refresh_field("g_bom");
                frm.refresh_field("project_name");
                frm.refresh_field("g_item");
                frm.refresh_field("item");
                frm.refresh_field("items");
                frm.refresh_field("bom_discount_detial");
           // }
        }
        if(frm.doc.type == 'Project'){
            frm.set_value("item",null);
            frm.clear_table("items");
            frm.refresh_field("item");
        }
        frm.refresh()
    },
    project_name: function(frm){
        if(frm.doc.project_name){
            frm.set_value("project",frm.doc.project_name);
        }
    },
    g_bom: function(frm){
        if(frm.doc.g_bom){
            frappe.call({
                method: "electrical_contracting.electrical_contracting.doctype.bom.bom_custom.get_generic_details",
                args:{
                    'g_bom': frm.doc.g_bom
                },
                callback:function(r){
                    if(!r.exc){
                        frm.clear_table("items");
                        frm.refresh_field("items");
                        for (var i=0; i<r.message.length; i++){
                            var d = frm.add_child("items");
                            var item = r.message[i];
                            //if(item.item_group == 'Services')
                            //{
                                //frappe.model.set_value(d.doctype, d.name, "item_code", item.item_code);
                                ////d.item_code = item.item_code;
                            //}
                            frappe.model.set_value(d.doctype, d.name, "g_item_code", item.item_code);
                            //d.g_item_code = item.item_code;
                            frappe.model.set_value(d.doctype, d.name, "activity_type", item.activity_type);
                            //d.activity_type = item.activity_type;
                            frappe.model.set_value(d.doctype, d.name, "qty", item.qty);
                            frappe.model.set_value(d.doctype, d.name, "uom", item.uom);
                            //d.qty = item.qty;
                            //d.uom = item.uom;
                            frm.refresh_field("items");
                        }
                    }
                }
            })
        }
    },
    g_item: function(frm){
        if(frm.doc.project && frm.doc.g_item){
            frm.set_value("item",frm.doc.project+'_'+frm.doc.g_item);
            frappe.call({
                method: 'frappe.client.get_value',
                args:{
                    'doctype':'BOM',
                    'filters':{
                        'item': frm.doc.g_item,
                        'docstatus': 1,
                        'is_default': 1
                    },
                    'fieldname':['name']
                },
                callback:function(r){
                    if (!r.exc) {
                        var a = r.message.name;
                        frm.set_value("g_bom",r.message.name);
                    }
                }
            });
        }
    },
    project: function(frm){          
        if(frm.doc.project){
            cur_frm.set_query("g_item", function() {
                return {
                    "query": "electrical_contracting.electrical_contracting.doctype.bom.bom_custom.get_sales_order_items",
                    "filters":{
                        "project":frm.doc.project
                    }
                };
            });
            $.each(frm.doc.bom_discount_detial || [], function(i, d) {
                frappe.model.set_value(d.doctype, d.name,"project",frm.doc.project)
            });
        }
    }
})
frappe.ui.form.on('BOM Item', {
    activity_type: function(frm, cdt, cdn){
       // if(frm.doc.type == 'Project'){
            var d = locals[cdt][cdn];
            var flag = false;
            var item = d.activity_type;      
            $.each(frm.doc.items || [], function(i, v) {
                if(v.item_code == item){
                    flag = true;
                }
            }); 
            if(flag != true){
                var bom_item = frm.add_child("items");
                frappe.model.set_value(bom_item.doctype, bom_item.name, "item_code", item);
                cur_frm.refresh_field("items");
            }  
        //}   
    },  
    item_code: function(frm, cdt, cdn){
        if(frm.doc.type == 'Project'){
        var d = locals[cdt][cdn];
        var item = d.item_code;
        var item_group = '';
   //-------to get item group of selected item----------
        frappe.call({
            method: 'frappe.client.get_value',
            args: {
                    'doctype': 'Item',
                    'filters': {'name': item},
                    'fieldname': [
                         'item_group',
                         'stock_uom'
                     ]
     },
     callback: function(s) {
                if (!s.exc) {
                    var flag = false;
                    item_group = s.message.item_group;
                    $.each(frm.doc.bom_discount_detial || [], function(i, v) {
                        if(v.item_group == item_group)
                        {
                            flag = true;
                        }
                    });
                    if(flag != true && item_group != 'Services')
                    {
                        frappe.call({
                            method: 'frappe.client.get_value',
                            args: {
                                'parent': 'Project Discount',
                                'doctype': 'Project Discount Detail',
                                'filters': {'parentfield': 'discount_detail','item_group': item_group,'project': frm.doc.project},
                                'fieldname': [
                                     'item_group',
                                     'discount_percentage'
                                 ]
                        },
                        callback : function(r) {
                            // add item group into table 'bom discount detail'
                            if(!r.exc)
                            {
                                if(r.message){
                                        d = frm.add_child("bom_discount_detial");
                                        d.item_group = r.message.item_group;
                                        d.project = frm.doc.project;
                                        d.discount_percentage = r.message.discount_percentage;
                                        cur_frm.refresh_field("bom_discount_detial");
                                }
                                else{
                                        d = frm.add_child("bom_discount_detial");
                                        d.item_group = item_group;
                                        d.project = frm.doc.project;
                                        cur_frm.refresh_field("bom_discount_detial");
                                }
                            }
                        }
                        })
                    }
                    
                }
             }
        })
      }       
    }
});