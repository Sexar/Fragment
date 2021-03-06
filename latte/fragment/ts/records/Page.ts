/**
 * Generated by xlatte
 */
module latte{

	/**
	 * Record for table page
	 */
	export class Page extends pageBase{

		//region Static
		/**
		 * Allows the user to see the page and access the fragments of the page.
		 * @type {number}
		 */
		static PERMISSION_READ = 1;

		/**
		 * Allows the user to modify the page after it becomes online.
		 * @type {number}
		 */
		static PERMISSION_WRITE = 2;

		/**
		 * Allows the user to delete the page.
		 * @type {number}
		 */
		static PERMISSION_DELETE = 4;

		/**
		 * Allows the user to insert new children to the page.
		 * @type {number}
		 */
		static PERMISSION_INSERT_CHILD = 8;

		/**
		 * Allows the user to read children of the page. User gets to know the children he owns.
		 * @type {number}
		 */
		static PERMISSION_READ_CHILDREN = 16;


		//endregion

		//region Fields

		//endregion

		//region  Methods
        /**
         * Returns a boolean indicating if the user has the specified permission for the page
         * @param permission
         */
        canI(permission: number): boolean{

            if(User.me.isRoot) {
                return true;
            }

            let owner = (this.powner & permission) == permission;
            let group = (this.pgroup & permission) == permission;
            let other = (this.pother & permission) == permission;
            let can = false;

            if(other) {
                return true;
            }

            if(owner || group) {
                can = owner && this.iduser == User.me.iduser;

                if(!can && User.me.inGroup(this.idgroup)) {
                    can = true;
                }
            }

            return can;
        }

		/**
		 * Gets the metadata about the record
		 *
		 * @returns Object
		 */
		getMetadata(): IRecordMeta {
			return {
				fields: {
					idparent: {
						visible: false
					},
					guid: {
						text: strings.guid,
						type: 'string',
						readOnly: true,
						visible: 'if-inserted'
					},
					online: {
						text: strings.online,
						type: 'switch',
                        visible: 'if-inserted'
					},
					title: {
						text: strings.title,
						type: 'string'
					},
					description: {
						text: strings.description,
						type: 'string'
					},
					key: {
						text: strings.pageKey,
						type: 'string'
					},
					template: {
						category: 'advanced',
						text: strings.template,
						type: 'string',
                        visible: 'if-inserted'
					},
					trash:{
						text: strings.inTrash,
						type: 'boolean',
						visible: false
					},
					created: {
						category: 'advanced',
						text: strings.created,
						type: 'datetime',
						readOnly: true,
						visible: 'if-inserted'
					},
					modified: {
						category: 'advanced',
						text: strings.modified,
						type: 'string',
						readOnly: true,
						visible: 'if-inserted'
					},
					sort: {
						category: 'advanced',
						text: strings.pageSort,
						type: 'combo',
						defaultValue: 'created-asc',
						options: {
							'created-asc': strings.pageSortCreatedAsc,
							'created-desc': strings.pageSortCreatedDesc,
							'modified-asc': strings.pageSortModifiedAsc,
							'modified-desc': strings.pageSortModifiedDesc,
							'title-asc': strings.pageSortTitleAsc,
							'title-desc': strings.pageSortTitleDesc,
							'custom': strings.pageSortCustom,
						},
						visible: 'if-inserted'
					},
					order:{
						category: 'advanced',
						text: strings.pageSortIndex,
						type: 'number',
						visible: this.sort == 'custom'
					},
                    idgroup: {
						category: 'advanced',
                        text:  strings.group,
                        type: 'record',
                        recordType: 'Group',
                        loaderFunction: Group.suggestionLoader(),
                        visible: 'if-inserted',
						readOnly: !User.me.isRoot
                    },
                    iduser: {
						category: 'advanced',
                        text:  strings.user,
                        type: 'record',
                        recordType: 'User',
                        loaderFunction: User.suggestionLoader(),
                        visible: 'if-inserted',
						readOnly: !User.me.isRoot
                    },
					powner:{
						category: 'advanced',
						text: strings.owner,
						type: 'flags',
						options:{
							1: strings.readPermission,
                            2: strings.writePermission,
                            4: strings.removePermission,
                            8: strings.insertChildPermission,
                            16: strings.readChildrenPermission
						},
                        visible: 'if-inserted'
					},
					pgroup:{
						category: 'advanced',
						text: strings.group,
						type: 'flags',
						options:{
							1: strings.readPermission,
							2: strings.writePermission,
							4: strings.removePermission,
							8: strings.insertChildPermission,
							16: strings.readChildrenPermission
						},
                        visible: 'if-inserted'
					},
					pother:{
						category: 'advanced',
						text: strings.permissionsOther,
						type: 'flags',
						options:{
							1: strings.readPermission,
							2: strings.writePermission,
							4: strings.removePermission,
							8: strings.insertChildPermission,
							16: strings.readChildrenPermission
						},
                        visible: 'if-inserted'
					},
					pworld:{
						category: 'advanced',
						text: strings.permissionsWorld,
						type: 'flags',
						options:{
							1: strings.readPermission,
							16: strings.readChildrenPermission
						},
						defaultValue: 17,
                        visible: 'if-inserted'
					}
				}
			}
		}

        /**
         * Override.
         * @param form
         */
		onFormCreated(form: DataRecordFormItem){

			// Change color of iduser
			// form.byName('guid').visible = this.inserted();
			// form.byName('created').visible = this.inserted();
			// form.byName('modified').visible = this.inserted();

            let sw = form.byName('online');

            // debugger;
            if(sw) {
                sw.valueChanged.add(() => {
                    if(sw.value) {
                        if(this.isMineAndCantWrite) {
                            let d = DialogView.ask(
                                strings.areYouSureSetPageOnline,
                                strings.areYouSureSetPageOnlineDesc,
                                [
                                    new ButtonItem(strings.yesMakeOnline, null, () => {
                                        this.setOnline(true).send(() => {
                                        	this.online = true;
											this.onOnlineSwitched();
                                            log("Has been set online.");
                                        });
                                    }),
                                    new ButtonItem(strings.cancel, null, () => {
                                        sw.value = false;
                                    })
                                ]
                            );

                            d.closeButton.visible = false;
                        }
                    }
                });
            }

		}

		/**
		 * Raises the <c>onlineSwitched</c> event
		 */
		onOnlineSwitched(){
			if(this._onlineSwitched){
				this._onlineSwitched.raise();
			}
		}
		
		//endregion

		//region Events

		/**
		 * Back field for event
		 */
		private _onlineSwitched: LatteEvent;

		/**
		 * Gets an event raised when the online attribute has been switched
		 *
		 * @returns {LatteEvent}
		 */
		get onlineSwitched(): LatteEvent{
		    if(!this._onlineSwitched){
		        this._onlineSwitched = new LatteEvent(this);
		    }
		    return this._onlineSwitched;
		}

		//endregion

		//region Properties

        /**
         * Gets a value indicating if user has WRITE permission
         *
         * @returns {boolean}
         */
        get canIDelete(): boolean {
            return this.canI(Page.PERMISSION_DELETE);
        }

        /**
         * Gets a value indicating if user has INSERT_CHILD permission
         *
         * @returns {boolean}
         */
        get canIInsertChild(): boolean {
            return this.canI(Page.PERMISSION_INSERT_CHILD);
        }

        /**
         * Gets a value indicating if user has READ permission
         *
         * @returns {boolean}
         */
        get canIRead(): boolean {
            return this.canI(Page.PERMISSION_READ);
        }

        /**
         * Gets a value indicating if the user has READ_CHILDREN permission
         *
         * @returns {boolean}
         */
        get canIReadChildren(): boolean {
            return this.canI(Page.PERMISSION_READ_CHILDREN);
        }

        /**
         * Gets a value indicating if user has WRITE permission
         *
         * @returns {boolean}
         */
        get canIWrite(): boolean {
            return this.canI(Page.PERMISSION_WRITE) || (this.isMine && !this.isOnline);
        }


        /**
         * Property field
         */
        private _configurationSetting:Setting = null;

        /**
         * Gets or sets the configuration of the page
         *
         * @returns {Setting}
         */
        get configurationSetting():Setting {
            return this._configurationSetting;
        }

        /**
         * Gets or sets the configuration of the page
         *
         * @param {Setting} value
         */
        set configurationSetting(value:Setting) {
            this._configurationSetting = value;
            this._configuration = null;
        }

        /**
         * Field for configuration property
         */
        private _configuration: PageConfiguration;

        /**
         * Gets the configuration helper for the page
         *
         * @returns {PageConfiguration}
         */
        get configuration(): PageConfiguration {
            if (!this._configuration) {
                this._configuration = new PageConfiguration(this);
            }
            return this._configuration;
        }

		/**
 		 * Gets a value indicating if the page belongs to the logged user
		 *
		 * @returns {boolean}
		 */
		get isMine(): boolean {
			return this.iduser == User.me.iduser;
		}

        /**
         * Gets a value indicating if the user owns the page and has not write permissions
         *
         * @returns {boolean}
         */
        get isMineAndCantWrite(): boolean {
            return !this.canI(Page.PERMISSION_WRITE) && this.isMine;
        }


        /**
         * Gets a value indicating if the page is currently online
         *
         * @returns {boolean}
         */
        get isOnline(): boolean {
            return this.online;
        }


        //endregion

	}
}