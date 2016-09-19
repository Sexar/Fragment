/**
 * Created by josemanuel on 7/14/16.
 */
module latte {

    /**
     *
     */
    export class Main {

        //region Static

        static goEditorView(guid: string){

            Page.byUrlQ(guid).send((p: Page) => {
                View.mainView = new PageEditorView(p);
            });

        }

        static goMainView(){

            let body = new Element<HTMLBodyElement>(document.body);

            body.clear();

            View.mainView = new CmsMainView();
        }

        static goSignInView(){
            let v = new SignInView();
            document.body.appendChild(v.element);
        }

        static logOut(){
            View.mainView = null;
            Session.logOut().send(() => {
                document.location.reload();
            });
        }
        //endregion

        //region Fields
        //endregion

        /**
         * Boots the script
         */
        constructor() {
            console.log('%cF R %cΔ %cG M E N T',
                'letter-spacing: 10px; font-size: 30px; color: #000; text-shadow: 0px 3px 3px rgba(0,0,0,0.2); font-family:"Avenir Next","Myriad",sans-serif;',
                'letter-spacing: 10px; font-size: 30px; color: #ff4d4d; text-shadow: 0px 0px 7px rgba(255,66,66,0.5); font-family:"Avenir Next","Myriad",sans-serif;',
                'letter-spacing: 10px; font-size: 30px; color: #000; text-shadow: 0px 3px 3px rgba(0,0,0,0.2); font-family:"Avenir Next","Myriad",sans-serif;');
            console.log('http://github.com/menendezpoo/Fragment');

            _latteUrl('/fragment/latte');

            FragmentAdapterManager.register('text', 'PlainTextFragmentAdapter');
            FragmentAdapterManager.register('html', 'HtmlFragmentAdapter');
            FragmentAdapterManager.register('gallery', 'ImageGalleryFragmentAdapter');


            if(window['loggedFragmentUser']) {
                User.me = <User>DataRecord.fromServerObject(window['loggedFragmentUser']);
                if(window.location.hash.indexOf('#/Editor/') === 0) {
                    Main.goEditorView(window.location.hash.substr(9));
                }else{
                    Main.goMainView();
                }
            }else {
                Main.goSignInView();
            }

        }

        //region Private Methods
        //endregion

        //region Methods
        //endregion

        //region Events
        //endregion

        //region Properties
        //endregion

    }

}