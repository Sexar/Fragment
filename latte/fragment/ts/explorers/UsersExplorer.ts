/**
 * Created by josemanuel on 8/5/16.
 */
module latte {

    /**
     *
     */
    export class UsersExplorer extends ExplorerItem {

        //region Static
        //endregion

        //region Fields
        //endregion

        /**
         *
         */
        constructor() {
            super();

            this.loadsChildrenFolders = false;
        }

        //region Private Methods
        //endregion

        //region Methods
        /**
         * Gets the loader of children items
         *
         * @Override
         */
        getChildrenLoader(): RemoteCall<any>{
            return User.catalog().withHandlers((records: User[]) => {
                for(let i in records){
                    this.children.add(new UserExplorer(records[i]));
                }
            });
        }

        /**
         * Gets the name of the item
         * @Override
         */
        getName(): string{
            return strings.users;
        }

        /**
         * Gets the icon of the item
         * @Override
         */
        getIcon(): IconItem{
            return IconItem.folderIcon()
        }

        /**
         * Gets the items (actions) of the item
         * @Override
         */
        getItems(): Item[]{
            return [
                new ButtonItem(strings.newUser, IconItem.newIcon(), () => {
                    var r = new User();
                    DataRecordDialogView.editRecord(r, () => this.onChildrenChanged(), strings.newUser);
                })
            ]
        }
        //endregion

        //region Events
        //endregion

        //region Properties
        //endregion

    }

}