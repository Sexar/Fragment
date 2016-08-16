<?php
/**
 * Stub generated by xlatte
 */
class Page extends pageBase{

    /**
     * Length to use in GUIDs
     */
    const GUID_LENGTH = 10;

    /**
     * Key used to store the page configuration settings
     */
    const CONFIGURATION_SETTINGS_KEY = 'page-configuration';

    /**
     * Flag to indicate page is homepage
     */
    const FLAG_HOMEPAGE = 1;

    /**
     * Flag to indicate page is in trash
     */
    const FLAG_TRASH = 1024;

    /**
     * Allows the user to see the page and access the fragments of the page
     */
    const PERMISSION_READ = 1;

    /**
     * Allows the user to modify the page
     */
    const PERMISSION_WRITE = 2;

    /**
     * Allows the user to delete the page
     */
    const PERMISSION_DELETE = 4;

    /**
     * Allows user to insert new children to the page
     */
    const PERMISSION_INSERT_CHILD = 8;

    /**
     * Allows the user to read children of the page. User gets to know the children he owns.
     */
    const PERMISSION_READ_CHILDREN = 16;

    /**
     * Map of character normalization for URLS
     * @var array
     */
    public static $normalizeChars = array(
        'Š'=>'S', 'š'=>'s', 'Ð'=>'Dj','Ž'=>'Z', 'ž'=>'z', 'À'=>'A', 'Á'=>'A', 'Â'=>'A', 'Ã'=>'A', 'Ä'=>'A',
        'Å'=>'A', 'Æ'=>'A', 'Ç'=>'C', 'È'=>'E', 'É'=>'E', 'Ê'=>'E', 'Ë'=>'E', 'Ì'=>'I', 'Í'=>'I', 'Î'=>'I',
        'Ï'=>'I', 'Ñ'=>'N', 'Ò'=>'O', 'Ó'=>'O', 'Ô'=>'O', 'Õ'=>'O', 'Ö'=>'O', 'Ø'=>'O', 'Ù'=>'U', 'Ú'=>'U',
        'Û'=>'U', 'Ü'=>'U', 'Ý'=>'Y', 'Þ'=>'B', 'ß'=>'Ss','à'=>'a', 'á'=>'a', 'â'=>'a', 'ã'=>'a', 'ä'=>'a',
        'å'=>'a', 'æ'=>'a', 'ç'=>'c', 'è'=>'e', 'é'=>'e', 'ê'=>'e', 'ë'=>'e', 'ì'=>'i', 'í'=>'i', 'î'=>'i',
        'ï'=>'i', 'ð'=>'o', 'ñ'=>'n', 'ò'=>'o', 'ó'=>'o', 'ô'=>'o', 'õ'=>'o', 'ö'=>'o', 'ø'=>'o', 'ù'=>'u',
        'ú'=>'u', 'û'=>'u', 'ý'=>'y', 'þ'=>'b', 'ÿ'=>'y', 'ƒ'=>'f'
    );

    /**
     * Returns a page from the specified URL query token.
     * The q variable may be the guid or the key of the page.
     *
     * @param $q
     * @return Page
     * @throws SecurityException
     */
    public static function byUrlQ($q){

        if (strpos($q, '"') !== false || strpos($q, "'") !== false){
            throw new SecurityException('Suspicious $q');
        }

        return DL::oneOf('Page', "
            SELECT #COLUMNS
            FROM page
            WHERE guid = '$q'
            OR `key` = '$q'
        ");
    }

    /**
     * Generates a unique GUID
     *
     * @return string
     */
    public static function generateGUID(){
        $chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890_-";
        $max = strlen($chars) - 1;
        $guid = "";

        do{
            while(strlen($guid) != self::GUID_LENGTH){
                $guid .= substr($chars, rand(0, $max), 1);
            }
        }while(DL::getSingle("SELECT COUNT(*) FROM page WHERE guid = '$guid'") > 0);

        return $guid;
    }

    /**
     * Cleans a string to be used in an URL
     *
     * @param string $toClean
     * @return string
     */
    public static function normalizeForURL($toClean) {
        $allowed = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM.-_';

        $toClean     =      strtolower($toClean);
        $toClean     =     str_replace('&', '-and-', $toClean);
        $toClean     =    trim(preg_replace('/[^\w\d_ -\.]/si', '', $toClean));//remove all illegal chars
        $toClean     =     str_replace(' ', '-', $toClean);
        $toClean     =     str_replace('--', '-', $toClean);

        $toClean = strtr($toClean, self::$normalizeChars);

        $fileName = null;

        // Filter valid chars
        foreach(str_split($toClean) as $char)
            if(strpos($allowed, $char) !== false)
                $fileName .= $char;

        return $fileName;
    }

    /**
     * @remote
     * @return Page[]
     */
    public static function rootPages(){
        return DL::arrayOf('Page, Setting configurationSetting', "
            SELECT #COLUMNS
            FROM page
             INNER JOIN setting configurationSetting ON (configurationSetting.idowner = page.idpage AND owner = 'Page' AND configurationSetting.name = 'page-configuration')
            WHERE idparent = '0'
        ");
    }

    /**
     * Configuration of page
     * @var Setting
     */
    var $configuration;

    /**
     * @var Page
     */
    private $_parent = false;

    /**
     * @var Setting
     */
    private $_configuration = null;

    /**
     * @var array
     */
    private $_configurationArr = null;

    /**
     * Gets the default permissions for the children of the page
     * @return array
     */
    private function getDefaultChildrenPermissions(){
        $config = $this->getConfigurationArr();
        $owner = 59;
        $group = 17;
        $other = 0;
        $world = 17;

        if ($config['children'] && $config['children']['permissions']){

            $p = $config['children']['permissions'];

            if ($p['owner']){
                $owner = $p['owner'];
            }

            if ($p['group']){
                $group = $p['group'];
            }

            if ($p['other']){
                $other = $p['other'];
            }

            if ($p['world']){
                $world = $p['world'];
            }
        }

        return array(
            'owner' => $owner,
            'group' => $group,
            'other' => $other,
            'world' => $world
        );
    }

    /**
     * Checks if the logged user has the specified permission
     * @param int $p
     * @return bool
     */
    public function canI($p){

        if (!Session::isLogged()){
            return ($this->pworld & $p) == $p;
        }

        if(Session::me()->isRoot()){
            return true;
        }

        $owner = ($this->powner & $p) == $p;
        $group = ($this->pgroup & $p) == $p;
        $other = ($this->pother & $p) == $p;
        $can = false;

        if($other){
            return true;
        }

        if($owner || $group){

            // Owner check
            $can = $owner && $this->iduser == Session::idUser();

            // Other check
            if(!$can && Session::me()->inGroup($this->idgroup)){
                $can = true;
            }

        }

        return $can;
    }

    /**
     * Gets a value indicating if the user can write to the page at the moment
     * @return bool
     */
    public function canIWrite(){
        return $this->canI(self::PERMISSION_WRITE) || ($this->isMine() && !$this->isOnline());
    }

    /**
     * @neverRemote
     * @return Setting
     */
    private function getConfigurationSetting(){
        if(!$this->_configuration){

            $c = Setting::byRecord($this, self::CONFIGURATION_SETTINGS_KEY);

            if(!$c){
                $c = new Setting();
                $c->name = self::CONFIGURATION_SETTINGS_KEY;
                $c->value = '';
                $c->saveForRecord($this);
            }

            $this->_configuration = $c;
        }

        return $this->_configuration;
    }

    /**
     * Gets the configuration of the page
     *
     * @remote
     * @return string
     */
    public function getConfiguration(){
        return $this->getConfigurationSetting()->value;
    }

    /**
     * Gets the configuration as an associative array
     * @return mixed
     */
    public function getConfigurationArr(){
        if(!$this->_configurationArr){
            $this->_configurationArr = json_decode($this->getConfiguration(), true);
        }
        return $this->_configurationArr;
    }

    /**
     * Saves the configuration of the page
     *
     * @remote
     * @param string $json
     * @return Setting
     * @throws SecurityException If not root or sysadmin
     */
    public function setConfiguration($json){
        $c = $this->getConfigurationSetting();
        $c->value = $json;
        $c->saveForRecord($this);
        return $c;
    }

    /**
     * Returns the parent page
     *
     * @return Page
     */
    public function getParent(){
        if($this->_parent === false){
            if($this->idparent > 0)
            $this->_parent = Page::byAuto($this->idparent);
        }
        return $this->_parent;
    }

    /**
     * Returns the fragments of the page
     *
     * @remote
     * @return Fragment[]
     * @throws SecurityException When PERMISSION_READ is missing
     */
    public function getFragments(){
//        if (!$this->canI(self::PERMISSION_READ)){
//            throw new SecurityException("Missing permission PERMISSION_READ");
//        }
        return DL::arrayOf('Fragment', "
            SELECT #COLUMNS
            FROM fragment
            WHERE idpage = '$this->idpage'
        ");
    }

    /**
     * Gets the appliable fragments (including specified by parent) with records
     * @return array
     */
    public function getFragmentsWithRecords(){
        $result = array();
        $fragments = DL::associativeArray($this->getFragments(), 'name');
        $config = $this->getConfigurationArr();
        $parentConfig = $this->getParent() ? $this->getParent()->getConfigurationArr() : array();

        // Get all fragments
//        $all_frags = array_merge(
//            (is_array($config['fragments']) ? $config['fragments'] : array()),
//            (is_array($parentConfig['children']) && is_array($parentConfig['children']['fragments']) ? $parentConfig['children']['fragments'] : array())
//        );

        $all_frags = array();

        if (is_array($config['fragments'])){
            foreach($config['fragments'] as $i => $f){

                $key = '';

                if($f['key']){
                    $key = $f['key'];

                }else if(!is_numeric($i)){
                    $key = $i;

                }else{
                    $key = 'MISSING_KEY';
                }

                $f['key'] = $key;
                $all_frags[] = $f;
            }
        }

        if (is_array($parentConfig['children']) && is_array($parentConfig['children']['fragments'])){
            foreach($parentConfig['children']['fragments'] as $i => $f){
                $key = '';

                if($f['key']){
                    $key = $f['key'];

                }else if(!is_numeric($i)){
                    $key = $i;

                }else{
                    $key = 'MISSING_KEY';
                }

                $f['key'] = $key;
                $all_frags[] = $f;
            }
        }
//        echo "[PRENT]";
//        print_r($parentConfig);
//        echo "[/PARENT]";
//
//        echo "[FRAGS]";
//        print_r($all_frags);
//        echo "[/FRAGS]";

        foreach($all_frags as $f){
            $key = $f['key'];

            if($fragments[$key])
                $f['record'] = $fragments[$key];

            $result[$key] = $f;
        }

        return $result;

    }

    /**
     * Gets the child pages of the page.
     * This method can be a little confuse because is a paginated result. Page parameter refers to pagination.
     *
     * @remote
     * @param int $page Index of page
     * @param * $options Options to load
     * @return PageResult<Page>
     */
    public function getPages($page = 1, $options = null){

        //TODO: AQUI ME QUEDE. Implementa un search() como el de product
        // para traer Pages con Settings, Fragments,
        // filtros por settings etc

        $ownerAnd = '';
        $orderBy = 'page.created ASC';

        // If no permission to read chilren, return only the ones where user is owner
        if(!$this->canI(self::PERMISSION_READ_CHILDREN)){
            $ownerAnd = "AND iduser = '" . Session::idUser() . "'";
        }

        if ($this->sort == 'created-desc'){
            $orderBy = 'page.created DESC';

        }else if ($this->sort == 'modified-asc'){
            $orderBy = 'page.modified ASC';

        }else if ($this->sort == 'modified-desc'){
            $orderBy = 'page.modified DESC';

        }else if ($this->sort == 'title-asc'){
            $orderBy = 'page.title ASC';

        }else if ($this->sort == 'title-desc'){
            $orderBy = 'page.title DESC';

        }else if ($this->sort == 'custom'){
            $orderBy = 'page.`order` ASC';
        }

        $p = DL::pageOf('Page, Setting configurationSetting', "
            SELECT #COLUMNS
            FROM page
             INNER JOIN setting configurationSetting ON (configurationSetting.idowner = page.idpage AND owner = 'Page' AND configurationSetting.name = 'page-configuration')
            WHERE idparent = '$this->idpage'
            $ownerAnd
            ORDER BY $orderBy
        ", $page);

        return $p;
    }

    /**
     * Gets the settings of the page, including the parent ones.
     * @remote
     * @return *
     */
    public function getSettingsPack(){

        $parent = $this->getParent();

        return array(
            'config' => $this->getConfiguration(),
            'parentConfig' => $parent ? $parent->getConfiguration() : null,
            'settings' => Setting::byRecordAll($this)
        );
    }

    /**
     * Gets the url of the page
     * @return string
     */
    public function getUrl(){
        if ($this->key){
            return "/$this->key";
        }else{
            return "/$this->guid";
        }
    }

    /**
     * Gets a value indicating if the page belongs to logged user
     * @return bool
     */
    public function isMine(){
        return $this->iduser == Session::idUser();
    }

    /**
     * Gets a value indicating if the page is online
     * @return bool
     */
    public function isOnline(){
        return $this->online > 0;
    }

    /**
     * Override.
     * @throws SecurityException
     */
    public function onDeleting(){
        if (!$this->canI(self::PERMISSION_DELETE)){
            throw new SecurityException("Missing PERMISSION_DELETE");
        }
    }

    /**
     * Override.
     * @throws SecurityException
     */
    public function onInserting(){

        if($parent = $this->getParent()){
            if(!$parent->canI(self::PERMISSION_INSERT_CHILD)){
                throw new SecurityException("Missing PERMISSION_INSERT_CHILD");
            }
        }else if(!Session::me()->isRoot()){
            throw new SecurityException("Only root users may insert root pages.");
        }

        $this->guid = Page::generateGUID();

        if(!$this->key){
            $this->key = self::normalizeForURL($this->title);
        }

        $this->created = DL::dateTime();
        $this->iduser = Session::idUser();

        if($parent = $this->getParent()){
            $this->idgroup = $parent->idgroup;
            $permissions = $parent->getDefaultChildrenPermissions();
            $this->powner = $permissions['owner'];
            $this->pgroup = $permissions['group'];
            $this->pother = $permissions['other'];
            $this->pworld = $permissions['world'];

            $config = $parent->getConfigurationArr();

            if ($config['children'] && $config['children']['template']){
                $this->template = $config['children']['template'];
            }else{
                $this->template = $parent->template;
            }
        }else{
            $this->idgroup = 1;
            $this->powner = 59; // Default owner permissions
            $this->pgroup = 17; // Default group permissions
            $this->pworld = 17; // Default world permissions
        }
    }

    /**
     * Override.
     */
    public function onInsert(){
        $this->setConfiguration('');
    }

    /**
     * Override.
     */
    public function onUpdating(){
        if (!$this->canIWrite()){
            return false;
        }
    }

    /**
     * Override.
     */
    public function onSaving(){
        $this->modified = DL::dateTime();
    }

    /**
     * @remote
     * @param boolean $online
     * @throws SecurityException
     */
    public function setOnline($online){
        if ($this->canIWrite()){
            $flag = $online ? 1 : 0;
            DL::update("UPDATE page SET online = '$flag' WHERE idpage = '$this->idpage'");
        }else{
            throw new SecurityException("Set online: No permissions to write");
        }
    }
}