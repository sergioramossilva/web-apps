/**
 *    LeftMenu.js
 *
 *    Controller
 *
 *    Created by Maxim Kadushkin on 10 April 2014
 *    Copyright (c) 2014 Ascensio System SIA. All rights reserved.
 *
 */

define([
    'core',
    'common/main/lib/util/Shortcuts',
    'presentationeditor/main/app/view/LeftMenu',
    'presentationeditor/main/app/view/FileMenu'
], function () {
    'use strict';

    PE.Controllers.LeftMenu = Backbone.Controller.extend(_.extend({
        views: [
            'LeftMenu',
            'FileMenu'
        ],

        initialize: function() {
            this._state = { no_slides: undefined };
            this.addListeners({
                /** coauthoring begin **/
                'Common.Views.Chat': {
                    'hide': _.bind(this.onHideChat, this)
                },
                'Statusbar': {
                    'click:users': _.bind(this.clickStatusbarUsers, this)
                },
                'LeftMenu': {
                    'panel:show':    _.bind(this.menuExpand, this),
                    'comments:show': _.bind(this.commentsShowHide, this, 'show'),
                    'comments:hide': _.bind(this.commentsShowHide, this, 'hide')
                },
                /** coauthoring end **/
                'Common.Views.About': {
                    'show':    _.bind(this.aboutShowHide, this, false),
                    'hide':    _.bind(this.aboutShowHide, this, true)
                },
                'FileMenu': {
                    'filemenu:hide': _.bind(this.menuFilesHide, this),
                    'item:click': _.bind(this.clickMenuFileItem, this),
                    'saveas:format': _.bind(this.clickSaveAsFormat, this),
                    'settings:apply': _.bind(this.applySettings, this),
                    'create:new': _.bind(this.onCreateNew, this),
                    'recent:open': _.bind(this.onOpenRecent, this)
                },
                'Toolbar': {
                    'file:settings': _.bind(this.clickToolbarSettings,this)
                },
                'SearchDialog': {
                    'hide': _.bind(this.onSearchDlgHide, this),
                    'search:back': _.bind(this.onQuerySearch, this, 'back'),
                    'search:next': _.bind(this.onQuerySearch, this, 'next')
                }
            });
        },

        onLaunch: function() {
            this.leftMenu = this.createView('LeftMenu').render();
            this.leftMenu.btnSearch.on('toggle', _.bind(this.onMenuSearch, this));
            this.leftMenu.btnThumbs.on('toggle', _.bind(this.onShowTumbnails, this));
            this.isThumbsShown = true;

            Common.util.Shortcuts.delegateShortcuts({
                shortcuts: {
                    'command+shift+s,ctrl+shift+s': _.bind(this.onShortcut, this, 'save'),
                    'command+f,ctrl+f': _.bind(this.onShortcut, this, 'search'),
                    'alt+f': _.bind(this.onShortcut, this, 'file'),
                    'esc': _.bind(this.onShortcut, this, 'escape'),
                    /** coauthoring begin **/
                    'alt+q': _.bind(this.onShortcut, this, 'chat'),
                    'command+shift+h,ctrl+shift+h': _.bind(this.onShortcut, this, 'comments'),
                    /** coauthoring end **/
                    'f1': _.bind(this.onShortcut, this, 'help')
                }
            });

            Common.util.Shortcuts.suspendEvents();
        },

        setApi: function(api) {
            this.api = api;
            this.api.asc_registerCallback('asc_onThumbnailsShow',        _.bind(this.onThumbnailsShow, this));
            this.api.asc_registerCallback('asc_onCoAuthoringDisconnect', _.bind(this.onApiServerDisconnect, this));
            Common.NotificationCenter.on('api:disconnect',               _.bind(this.onApiServerDisconnect, this));
            /** coauthoring begin **/
            if (this.mode.canCoAuthoring) {
                if (this.mode.canChat)
                    this.api.asc_registerCallback('asc_onCoAuthoringChatReceiveMessage', _.bind(this.onApiChatMessage, this));
                if (this.mode.canComments) {
                    this.api.asc_registerCallback('asc_onAddComment', _.bind(this.onApiAddComment, this));
                    this.api.asc_registerCallback('asc_onAddComments', _.bind(this.onApiAddComments, this));
                    var collection = this.getApplication().getCollection('Common.Collections.Comments');
                    for (var i = 0; i < collection.length; ++i) {
                        if (collection.at(i).get('userid') !== this.mode.user.id) {
                            this.leftMenu.markCoauthOptions('comments', true);
                            break;
                        }
                    }
                }
            }
            /** coauthoring end **/
            this.api.asc_registerCallback('asc_onCountPages',            _.bind(this.onApiCountPages, this));
            this.onApiCountPages(this.api.getCountPages());
            this.leftMenu.getMenu('file').setApi(api);
            return this;
        },

        setMode: function(mode) {
            this.mode = mode;
            this.leftMenu.setMode(mode);
            this.leftMenu.getMenu('file').setMode(mode);

            return this;
        },

        createDelayedElements: function() {
            /** coauthoring begin **/
            if ( this.mode.canCoAuthoring ) {
                this.leftMenu.btnComments[this.mode.isEdit&&this.mode.canComments ? 'show' : 'hide']();
                if (this.mode.canComments)
                    this.leftMenu.setOptionsPanel('comment', this.getApplication().getController('Common.Controllers.Comments').getView('Common.Views.Comments'));

                this.leftMenu.btnChat[this.mode.canChat ? 'show' : 'hide']();
                if (this.mode.canChat)
                    this.leftMenu.setOptionsPanel('chat', this.getApplication().getController('Common.Controllers.Chat').getView('Common.Views.Chat'));
            } else {
                this.leftMenu.btnChat.hide();
                this.leftMenu.btnComments.hide();
            }
            /** coauthoring end **/
            Common.util.Shortcuts.resumeEvents();
            this.leftMenu.btnThumbs.toggle(true);
            return this;
        },

        clickMenuFileItem: function(menu, action, isopts) {
            var close_menu = true;
            switch (action) {
            case 'back': break;
            case 'save': this.api.asc_Save(); break;
            case 'save-desktop': this.api.asc_DownloadAs(); break;
            case 'print': this.api.asc_Print(Common.Utils.isChrome || Common.Utils.isSafari || Common.Utils.isOpera); break;
            case 'exit': Common.NotificationCenter.trigger('goback'); break;
            case 'edit':
                this.getApplication().getController('Statusbar').setStatusCaption(this.requestEditRightsText);
                Common.Gateway.requestEditRights();
                break;
            case 'new':
                if ( isopts ) close_menu = false;
                else this.onCreateNew(undefined, 'blank');
                break;
            default: close_menu = false;
            }

            if (close_menu) {
                menu.hide();
                this.leftMenu.btnFile.toggle(false, true);
                this.menuExpand(this.leftMenu.btnFile, 'files', false);
            }
        },

        clickSaveAsFormat: function(menu, format) {
            this.api.asc_DownloadAs(format);
            menu.hide();
            this.leftMenu.btnFile.toggle(false, true);
            this.menuExpand(this.leftMenu.btnFile, 'files', false);
        },

        applySettings: function(menu) {
            var value = Common.localStorage.getItem("pe-settings-inputmode");
            this.api.SetTextBoxInputMode(parseInt(value) == 1);

            /** coauthoring begin **/
            if (this.mode.isEdit && this.mode.canLicense && !this.mode.isOffline) {
                value = Common.localStorage.getItem("pe-settings-coauthmode");
                var fast_coauth = (value===null || parseInt(value) == 1);
                this.api.asc_SetFastCollaborative(value===null || parseInt(value) == 1);
            }
            /** coauthoring end **/

            if (this.mode.canAutosave) {
                value = Common.localStorage.getItem("pe-settings-autosave");
                this.api.asc_setAutoSaveGap(parseInt(value));
            }

            value = Common.localStorage.getItem("pe-settings-showsnaplines");
            this.api.put_ShowSnapLines(value===null || parseInt(value) == 1);

            menu.hide();
            this.leftMenu.btnFile.toggle(false, true);
            this.menuExpand(this.leftMenu.btnFile, 'files', false);
        },

        onCreateNew: function(menu, type) {
            if (this.mode.nativeApp === true) {
                this.api.OpenNewDocument(type == 'blank' ? '' : type);
            } else {
                var newDocumentPage = window.open(type == 'blank' ? this.mode.createUrl : type, "_blank");
                if (newDocumentPage) newDocumentPage.focus();
            }

            if (menu) {
                menu.hide();
                this.leftMenu.btnFile.toggle(false, true);
                this.menuExpand(this.leftMenu.btnFile, 'files', false);
            }
        },

        onOpenRecent:  function(menu, url) {
            if (menu) {
                menu.hide();
                this.leftMenu.btnFile.toggle(false, true);
                this.menuExpand(this.leftMenu.btnFile, 'files', false);
            }

            var recentDocPage = window.open(url);
            if (recentDocPage)
                recentDocPage.focus();

            Common.component.Analytics.trackEvent('Open Recent');
        },

        clickToolbarSettings: function(obj) {
            if (this.leftMenu.btnFile.pressed && this.leftMenu.btnFile.panel.active == 'opts')
                this.leftMenu.close();
            else
                this.leftMenu.showMenu('file:opts');
        },

        /** coauthoring begin **/
        clickStatusbarUsers: function() {
            this.leftMenu.btnFile.panel.panels['rights'].changeAccessRights();
        },

        onHideChat: function() {
            $(this.leftMenu.btnChat.el).blur();
            Common.NotificationCenter.trigger('layout:changed', 'leftmenu');
        },
        /** coauthoring end **/

        onQuerySearch: function(d, w, opts) {
            if (opts.textsearch && opts.textsearch.length) {
                if (!this.api.findText(opts.textsearch, d != 'back')) {
                    var me = this;
                    Common.UI.info({
                        msg: this.textNoTextFound,
                        callback: function() {
                            me.dlgSearch.focus();
                        }
                    });
                }
            }
        },

        showSearchDlg: function(show) {
            if ( !this.dlgSearch ) {
                this.dlgSearch = (new Common.UI.SearchDialog({}));
            }

            if (show) {
                this.dlgSearch.isVisible() ? this.dlgSearch.focus() :
                    this.dlgSearch.show('no-replace');
            } else this.dlgSearch['hide']();
        },

        onMenuSearch: function(obj, show) {
            this.showSearchDlg(show);
        },

        onShowTumbnails: function(obj, show) {
            this.api.ShowThumbnails(show);

        },

        onThumbnailsShow: function(isShow) {
            if (isShow && !this.isThumbsShown) {
                this.leftMenu.btnThumbs.toggle(true, false);
            } else if (!isShow && this.isThumbsShown)
                this.leftMenu.btnThumbs.toggle(false, false);
            this.isThumbsShown = isShow;
        },

        onSearchDlgHide: function() {
            this.leftMenu.btnSearch.toggle(false, true);
            $(this.leftMenu.btnSearch.el).blur();
            this.api.asc_enableKeyEvents(true);
//            this.api.asc_selectSearchingResults(false);
        },

        onApiServerDisconnect: function() {
            this.mode.isEdit = false;
            this.leftMenu.close();

            /** coauthoring begin **/
            this.leftMenu.btnComments.setDisabled(true);
            this.leftMenu.btnChat.setDisabled(true);
            /** coauthoring end **/

            this.leftMenu.getMenu('file').setMode({isDisconnected: true});
            if ( this.dlgSearch ) {
                this.leftMenu.btnSearch.toggle(false, true);
                this.dlgSearch['hide']();
            }
        },

        onApiCountPages: function(count) {
            if (this._state.no_slides !== (count<=0) && this.mode.isEdit) {
                this._state.no_slides = (count<=0);
                /** coauthoring begin **/
                this.leftMenu.btnComments.setDisabled(this._state.no_slides);
                /** coauthoring end **/
                this.leftMenu.btnSearch.setDisabled(this._state.no_slides);
            }
        },

        menuExpand: function(obj, panel, show) {
            if (panel == 'thumbs') {
                this.isThumbsShown = show;
            } else {
                if (!show && this.isThumbsShown) {
                    this.leftMenu.btnThumbs.toggle(true, false);
                }
            }
        },

        menuFilesHide: function(obj) {
            $(this.leftMenu.btnFile.el).blur();
        },

        /** coauthoring begin **/
        onApiChatMessage: function() {
            this.leftMenu.markCoauthOptions('chat');
        },

        onApiAddComment: function(id, data) {
            if (data && data.asc_getUserId() !== this.mode.user.id)
                this.leftMenu.markCoauthOptions('comments');
        },

        onApiAddComments: function(data) {
            for (var i = 0; i < data.length; ++i) {
                if (data[i].Comment && data[i].Comment.asc_getUserId() !== this.mode.user.id) {
                    this.leftMenu.markCoauthOptions('comments');
                    break;
                }
            }
        },

        commentsShowHide: function(mode) {
//            var value = Common.localStorage.getItem("pe-settings-livecomment");
//            if (value!==null && parseInt(value) == 0)
//                (mode=='show') ? this.api.asc_showComments() : this.api.asc_hideComments();

            if (mode === 'show') {
                this.getApplication().getController('Common.Controllers.Comments').onAfterShow();
            }
                $(this.leftMenu.btnComments.el).blur();
        },
        /** coauthoring end **/

        aboutShowHide: function(value) {
            if (this.api)
                this.api.asc_enableKeyEvents(value);
             if (value) $(this.leftMenu.btnAbout.el).blur();
        },

        onShortcut: function(s, e) {
            var previewPanel = PE.getController('Viewport').getView('DocumentPreview');

            switch (s) {
                case 'search':
                    if ((!previewPanel || !previewPanel.isVisible()) && !this._state.no_slides)  {
                        Common.UI.Menu.Manager.hideAll();
                        var full_menu_pressed = (this.leftMenu.btnFile.pressed || this.leftMenu.btnAbout.pressed);
                        this.showSearchDlg(true);
                        this.leftMenu.btnSearch.toggle(true,true);
                        this.leftMenu.btnFile.toggle(false);
                        this.leftMenu.btnAbout.toggle(false);
                        full_menu_pressed && this.menuExpand(this.leftMenu.btnFile, 'files', false);
                    }
                    return false;
                case 'save':
                    if (this.mode.canDownload && (!previewPanel || !previewPanel.isVisible())){
                        if (this.mode.isDesktopApp && this.mode.isOffline) {
                            this.api.asc_DownloadAs();
                        } else {
                            Common.UI.Menu.Manager.hideAll();
                            this.leftMenu.showMenu('file:saveas');
                        }
                    }
                    return false;
                case 'help':
                    if (!previewPanel || !previewPanel.isVisible()){
                        Common.UI.Menu.Manager.hideAll();
                        this.leftMenu.showMenu('file:help');
                    }
                    return false;
                case 'file':
                    if (!previewPanel || !previewPanel.isVisible()) {
                        Common.UI.Menu.Manager.hideAll();
                        this.leftMenu.showMenu('file');
                    }
                    return false;
                case 'escape':
//                        if (!this.leftMenu.isOpened()) return true;
                    var statusbar = PE.getController('Statusbar');
                    var menu_opened = statusbar.statusbar.$el.find('.open > [data-toggle="dropdown"]');
                    if (menu_opened.length) {
                        $.fn.dropdown.Constructor.prototype.keydown.call(menu_opened[0], e);
                        return false;
                    }
                    if (this.leftMenu.btnFile.pressed ||  this.leftMenu.btnAbout.pressed ||
                        $(e.target).parents('#left-menu').length ) {
                        this.leftMenu.close();
                        Common.NotificationCenter.trigger('layout:changed', 'leftmenu');
                        return false;
                    }
                    break;
                /** coauthoring begin **/
                case 'chat':
                    if (this.mode.canCoAuthoring && this.mode.canChat && (!previewPanel || !previewPanel.isVisible())){
                        Common.UI.Menu.Manager.hideAll();
                        this.leftMenu.showMenu('chat');
                    }
                    return false;
                case 'comments':
                    if (this.mode.canCoAuthoring && this.mode.isEdit && this.mode.canComments && (!previewPanel || !previewPanel.isVisible()) && !this._state.no_slides) {
                        Common.UI.Menu.Manager.hideAll();
                        this.leftMenu.showMenu('comments');
                        this.getApplication().getController('Common.Controllers.Comments').onAfterShow();
                    }
                    return false;
                /** coauthoring end **/
            }
        },

        textNoTextFound         : 'Text not found',
        newDocumentTitle        : 'Unnamed document',
        requestEditRightsText   : 'Requesting editing rights...'
    }, PE.Controllers.LeftMenu || {}));
});