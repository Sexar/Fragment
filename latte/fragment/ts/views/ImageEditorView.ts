/**
 * Created by josemanuel on 9/27/16.
 */
module latte {

    export enum ImageZoomMode{
        ACTUAL_SIZE,
        FIT,
        NUMBER
    }

    /**
     * Possible areas of crop
     */
    export enum CropArea{
        NONE = 0,
        INSIDE = 1,
        TOP = 2,
        LEFT = 3,
        RIGHT = 4,
        BOTTOM = 5,
        TOP_LEFT = 6,
        TOP_RIGHT = 7,
        BOTTOM_LEFT = 8,
        BOTTOM_RIGHT = 9
    }

    export enum ImageEditorTool{
        NONE,
        CROP
    }

    /**
     *
     */
    export class ImageEditorView extends ToolbarView implements ISave {

        //region Static

        /**
         * Creates an editor, shows it and returns it without any image
         * @returns {latte.ImageEditorView}
         */
        static showEditor(save: () => any = null): ImageEditorView{
            let editor = new ImageEditorView();
            let current = View.mainView;

            editor.closeRequested.add(() => {
                View.mainView = current;
                editor.onClosed();
            });

            if(_isFunction(save)){
                editor.saveRequested.add(save);
            }

            View.mainView = editor;

            return editor;
        }

        /**
         * Shows the editor for the specified file
         * @param file
         */
        static editImageFile(file: File): ImageEditorView{

            if(!file.isImage) {
                throw "Not an image";
            }

            let editor = ImageEditorView.showEditor();

            editor.loadImageFromUrl(file.url);
            editor.saveRequested.add(() => {
                let img = editor.image;
                let can = editor.canvas;
                let rep = new FileReplacer();

                can.style.visibility = 'hidden';
                editor.infoItem = editor.progressItem;

                rep.id = String(file.idfile);
                rep.width = img.naturalWidth;
                rep.height = img.naturalHeight;
                rep.base64 = ImageUtil.getBase64(img.src);

                rep.progressChanged.add(() => {
                    editor.progressItem.value = Math.round(rep.progress * 100);
                });

                rep.complete.add(() => {
                    editor.progressItem = null;
                    can.style.visibility = 'visible';
                    editor.onSaved(); // Implementers have obligation to report this.
                });

                rep.upload();

            });

            return editor;

        }

        static editImageByUrl(url: string, save: () => any = null): ImageEditorView{
            let editor = ImageEditorView.showEditor(save);
            editor.loadImageFromUrl(url);
            return editor;
        }

        /**
         *
         * @param image
         * @param save
         * @returns {ImageEditorView}
         */
        static editImage(image: HTMLImageElement, save: () => any = null): ImageEditorView{

            let editor = ImageEditorView.showEditor(save);
            editor.image = image;
            return editor;

        }
        //endregion

        //region Fields
        private closeAfterSave = false;

        private bodyKeyChecker;

        private rCheckers = [];

        private draggingCropArea: CropArea = CropArea.NONE;

        //endregion

        /**
         * Creates the editor view
         */
        constructor() {
            super();

            this.addClass('image-editor');

            this.toolbar.faceVisible = false;
            this.toolbar.items.add(this.btnSave);
            this.toolbar.items.add(this.btnRotateCounterClockwise);
            this.toolbar.items.add(this.btnRotateClockwise);
            this.toolbar.items.add(this.btnCrop);
            this.toolbar.items.add(this.lblZoom);
            this.toolbar.sideItems.add(this.btnClose);
            this.toolbar.sideItems.add(this.btnCropNow);

            this.container.get(0).addEventListener('mousemove', (e) => this.mouseMove(e));
            this.container.get(0).addEventListener('mousedown', (e) => this.mouseDown(e));
            this.container.get(0).addEventListener('mouseup', (e) => this.mouseUp(e));
            this.container.append(this.canvas);

            this.bodyKeyChecker = (e: KeyboardEvent) => {
                if(e.keyCode == Key.ESCAPE) {
                    this.cancelCurrentAction();
                }
            };

            window.addEventListener('keydown', this.bodyKeyChecker);

        }

        //region Private Methods

        /**
         * Prepares UI for crop tool
         */
        private activateCrop(){
            if(this._cropper) {
                return;
            }

            this.canvas.appendChild(this.cropper.element);
            this.canvas.appendChild(this.cropperOverlayTop);
            this.canvas.appendChild(this.cropperOverlayLeft);
            this.canvas.appendChild(this.cropperOverlayRight);
            this.canvas.appendChild(this.cropperOverlayBottom);

            this.cropBounds = {};
        }

        /**
         * Handles click on the close button
         */
        private closeClick(){

            if(this.unsavedChanges) {
                DialogView.ask(strings.unsavedChanges, strings.saveChangesOnImageQ,
                [
                    new ButtonItem(strings.yesSaveChanges, null, () => {
                        this.closeAfterSave = true;
                        this.btnSave.onClick();
                    }),
                    new ButtonItem(strings.noIgnoreChanges, null, () => {
                        this.unsavedChanges = false;
                        this.onCloseRequested()
                    }),
                    new ButtonItem(strings.cancel)
                ])
            }else{
                this.onCloseRequested();
            }

        }

        /**
         * Actually performs the crop of the crop tool
         */
        private cropNow(){

            this.image = ImageUtil.cropImage(this.image, this.cropBounds);
            this.unsavedChanges = true;

            this.tool = ImageEditorTool.NONE;
        }

        /**
         * Checks image layout after image loading
         */
        private layoutCheck(){
            let img = this.image; if(!img) return;
            let size = new Size(this.container.width(), this.container.height());

            if(img.naturalWidth > size.width || img.naturalHeight > size.height) {
                this.zoomMode = ImageZoomMode.FIT;
            }else {
                this.zoomMode = ImageZoomMode.ACTUAL_SIZE;
            }
            this.canvas.style.visibility = 'visible';
        }

        /**
         * Gets the crop area depending on the specified point
         * @param x
         * @param y
         * @returns {any}
         */
        private getCropArea(x: number, y: number): CropArea{

            if(!this._cropper) {
                return CropArea.NONE;
            }

            let cr = this.canvas.getBoundingClientRect();
            let canvasr = new Rectangle(cr.left, cr.top, cr.width, cr.height);
            let br = this.cropper.element.getBoundingClientRect();
            let r = new Rectangle(br.left, br.top, br.width, br.height);
            let sense = 10;

            // Sensors
            let sTop = new Rectangle(r.left, r.top - sense, r.width, sense * 2);
            let sBottom = new Rectangle(r.left, r.bottom - sense, r.width, sense * 2);
            let sLeft = new Rectangle(r.left - sense, r.top, sense * 2, r.height);
            let sRight = new Rectangle(r.right - sense, r.top, sense * 2, r.height);
            let sTopLeft = new Rectangle(r.left - sense, r.top - sense, sense * 2, sense * 2);
            let sTopRight = new Rectangle(r.right - sense, r.top - sense, sense * 2, sense * 2);
            let sBottomLeft = new Rectangle(r.left - sense, r.bottom - sense, sense * 2, sense * 2);
            let sBottomRight = new Rectangle(r.right - sense, r.bottom - sense, sense * 2, sense * 2);

            let checkers: any = [
                [CropArea.TOP_LEFT, sTopLeft],
                [CropArea.TOP_RIGHT, sTopRight],
                [CropArea.BOTTOM_RIGHT, sBottomRight],
                [CropArea.BOTTOM_LEFT, sBottomLeft],
                [CropArea.TOP, sTop],
                [CropArea.LEFT, sLeft],
                [CropArea.RIGHT, sRight],
                [CropArea.BOTTOM, sBottom],
            ];

            //region Checker elements
            // if(this.rCheckers.length == 0) {
            //     let cre = () => {
            //         let a = document.createElement('div');
            //         a.className = 'rect-checker';
            //         this.container.append(a);
            //         return a;
            //     };
            //     this.rCheckers = [
            //         cre(), cre(), cre(), cre(),
            //         cre(), cre(), cre(), cre()
            //     ];
            // }
            // for(let i in checkers){
            //     let c: Rectangle = checkers[i][1];
            //     let e: HTMLDivElement = this.rCheckers[i];
            //     e.style.top = c.top + 'px';
            //     e.style.left = c.left + 'px';
            //     e.style.width = c.width + 'px';
            //     e.style.height = c.height + 'px';
            // }
            //endregion

            for(let i in checkers){
                let checker:Rectangle = checkers[i][1];

                if(checker.contains(x, y)) {
                    return checkers[i][0];
                }
            }


            if(canvasr.contains(x, y)) {
                return CropArea.INSIDE;
            }

            return CropArea.NONE;
        }

        /**
         * Handles editor mousemove
         * @param e
         */
        private mouseMove(e: MouseEvent){
            if(this.draggingCropArea) {
                this.updateCropperDrag(e.x, e.y);

            }else{
                if(this.tool == ImageEditorTool.CROP) {
                    this.mouseCropArea = this.getCropArea(e.clientX, e.clientY);
                }
            }
        }

        /**
         * Handles editor mouse up
         * @param e
         */
        private mouseUp(e: MouseEvent){

            if(this.draggingCropArea) {
                this.draggingCropArea = null;
                e.preventDefault();
                e.stopImmediatePropagation();
            }else{
                if(this.zoomMode == ImageZoomMode.FIT) {
                    this.zoomMode = ImageZoomMode.ACTUAL_SIZE;
                }else {
                    this.zoomMode = ImageZoomMode.FIT;
                }
            }
        }

        /**
         * Handles editor mouse down
         * @param e
         */
        private mouseDown(e: MouseEvent){

            let cropArea = this.getCropArea(e.clientX, e.clientY);

            if(cropArea != CropArea.NONE) {

                if(cropArea == CropArea.INSIDE) {
                    // Set cropper to cross-hair position
                    this.cropBounds = {
                        left: this.toActualX(e.clientX),
                        top: this.toActualY(e.clientY),
                    };
                    log(this.cropBounds);
                    // Set Crop Area to SouthEast
                    cropArea = CropArea.BOTTOM_RIGHT;
                }

                this.draggingCropArea = cropArea;
                e.preventDefault();
                e.stopImmediatePropagation();
            }
        }

        /**
         * Transforms a client coordinate to an image coordinate
         * @param x
         * @returns {number}
         */
        private toActualX(x: number): number{
            let r = this.canvas.getBoundingClientRect();
            return (x - r.left) / (this.canvas.clientWidth / this.image.naturalWidth);
        }

        /**
         * Transforms a client coordinate to an image coordinate
         * @param y
         * @returns {number}
         */
        private toActualY(y: number):number{
            let r = this.canvas.getBoundingClientRect();
            return (y - r.top) / (this.canvas.clientHeight / this.image.naturalHeight);
        }

        /**
         * Updates the cropper by the current draggingCropArea
         * @param x
         * @param y
         */
        private updateCropperDrag(x: number, y: number){

            let r = this.canvas.getBoundingClientRect();
            let b: ICropBounds = {}; for(let i in this.cropBounds) b[i] = this.cropBounds[i];
            let vz = this.canvas.clientHeight / this.image.naturalHeight;
            let hz = this.canvas.clientWidth / this.image.naturalWidth ;

            switch(this.draggingCropArea){
                case CropArea.TOP:
                    b.top = (y - r.top) / vz;
                    break;
                case CropArea.LEFT:
                    b.left = (x - r.left) / hz;
                    break;
                case CropArea.BOTTOM:
                    b.bottom = (r.bottom - y) / vz;
                    break;
                case CropArea.RIGHT:
                    b.right = (r.right - x) / hz;
                    break;
                case CropArea.TOP_LEFT:
                    b.top = (y - r.top) / vz;
                    b.left = (x - r.left) / hz;
                    break;
                case CropArea.TOP_RIGHT:
                    b.top = (y - r.top) / vz;
                    b.right = (r.right - x) / hz;
                    break;
                case CropArea.BOTTOM_LEFT:
                    b.bottom = (r.bottom - y) / vz;
                    b.left = (x - r.left) / hz;
                    break;
                case CropArea.BOTTOM_RIGHT:
                    b.bottom = (r.bottom - y) / vz;
                    b.right = (r.right - x) / hz;
                    break;
            }

            this.cropBounds = b;

        }

        //endregion

        //region Methods

        cancelCurrentAction(){
            switch(this.tool){
                case ImageEditorTool.NONE:
                    this.btnClose.onClick();
                    break;
                case ImageEditorTool.CROP:
                    this.tool = ImageEditorTool.NONE;
                    break;
            }
        }

        /**
         * Loads the image from the specified url
         * @param url
         */
        loadImageFromUrl(url: string){

            this.image = null;
            this.infoItem = this.progressItem;

            let loader = new ImageLoader(url);

            loader.progressChanged.add(() => {
                this.progressItem.value = loader.progress * 100;
            });

            loader.ended.add(() => {
                this.image = loader.resultImage;
                this.infoItem = null;
            });

            loader.start();

        }

        /**
         * Raises the <c>closed</c> event
         */
        onClosed(){
            if(this._closed){
                this._closed.raise();
            }
            window.removeEventListener('keydown', this.bodyKeyChecker);
        }

        /**
         * Raises the <c>closeRequested</c> event
         */
        onCloseRequested(){
            if(this._closeRequested){
                this._closeRequested.raise();
            }
        }

        /**
         * Raises the <c>cropBounds</c> event
         */
        onCropBoundsChanged(){
            if(this._cropBoundsChanged){
                this._cropBoundsChanged.raise();
            }

            if(this._cropper) {

                let vz = this.canvas.clientHeight / this.image.naturalHeight;
                let hz = this.canvas.clientWidth / this.image.naturalWidth ;
                let top = vz * (this.cropBounds.top || 0);
                let left = hz * (this.cropBounds.left || 0);
                let right = hz * (this.cropBounds.right || 0);
                let bottom = vz * (this.cropBounds.bottom || 0);
                this.cropper.style.top = top + 'px';
                this.cropper.style.left = left + 'px';
                this.cropper.style.right = right + 'px';
                this.cropper.style.bottom = bottom + 'px';

                this.cropperOverlayTop.style.height = top + 'px';
                this.cropperOverlayLeft.style.width = left + 'px';
                this.cropperOverlayLeft.style.top = top + 'px';
                this.cropperOverlayLeft.style.bottom = bottom + 'px';
                this.cropperOverlayRight.style.width = right + 'px';
                this.cropperOverlayRight.style.top = top + 'px';
                this.cropperOverlayRight.style.bottom = bottom + 'px';
                this.cropperOverlayBottom.style.height = bottom + 'px';
            }
        }

        /**
         * Raises the <c>editable</c> event
         */
        onEditableChanged(){
            if(this._editableChanged){
                this._editableChanged.raise();
            }

            this.btnSave.visible = this.editable;
            this.btnRotateClockwise.visible = this.editable;
            this.btnRotateCounterClockwise.visible = this.editable;
        }

        /**
         * Raises the <c>image</c> event
         */
        onImageChanged(){
            if(this._imageChanged){
                this._imageChanged.raise();
            }

            $(this.canvas).empty();
            this._cropper = null;

            if(this.image){
                this.zoomMode = null;
                this.canvas.appendChild(this.image)
                this.canvas.style.visibility = 'hidden';
                this.image.onload = () => {this.layoutCheck()}
            }
        }

        /**
         * Raises the <c>mouseCropArea</c> event
         */
        onMouseCropAreaChanged(){
            if(this._mouseCropAreaChanged){
                this._mouseCropAreaChanged.raise();
            }

            let n = 'default';

            switch(this.mouseCropArea){
                case CropArea.TOP:          n = 'ns-resize';    break;
                case CropArea.BOTTOM:       n = 'ns-resize';    break;
                case CropArea.LEFT:         n = 'ew-resize';    break;
                case CropArea.RIGHT:        n = 'ew-resize';    break;
                case CropArea.TOP_LEFT:     n = 'nwse-resize';  break;
                case CropArea.TOP_RIGHT:    n = 'nesw-resize';  break;
                case CropArea.BOTTOM_LEFT:  n = 'nesw-resize';  break;
                case CropArea.BOTTOM_RIGHT: n = 'nwse-resize';  break;
                case CropArea.INSIDE:       n = 'crosshair';    break;
            }

            this.container.css('cursor', n);
        }

        /**
         * Raises the <c>saveRequested</c> event
         */
        onSaveRequested(){
            if(this._saveRequested){
                this._saveRequested.raise();
            }
        }

        /**
         * Raises the <c>saved</c> event
         */
        onSaved(){
            if(this._saved){
                this._saved.raise();
            }

            this.unsavedChanges = false;

            if(this.closeAfterSave) {
                this.onCloseRequested();
            }

        }

        /**
         * Raises the <c>tool</c> event
         */
        onToolChanged(){
            if(this._toolChanged){
                this._toolChanged.raise();
            }

            switch(this.tool){
                case ImageEditorTool.NONE:
                    if(this._cropper) {
                        this._cropper.removeFromParent();
                        this._cropperOverlayTop.remove();
                        this._cropperOverlayLeft.remove();
                        this._cropperOverlayRight.remove();
                        this._cropperOverlayBottom.remove();
                        this._cropper = null;
                    }
                    this.btnCropNow.visible = false;
                    this.btnClose.visible = true;
                    this.btnCrop.enabled = true;
                    break;
                case ImageEditorTool.CROP:
                    this.activateCrop();
                    this.btnCropNow.visible = true;
                    this.btnClose.visible = false;
                    this.btnCrop.enabled = false;
                    break;
            }
        }

        /**
         * Override
         */
        onUnsavedChangesChanged(){
            super.onUnsavedChangesChanged();

            this.btnSave.enabled = this.unsavedChanges;

        }

        /**
         * Raises the <c>zoomMode</c> event
         */
        onZoomModeChanged(){
            if(this._zoomModeChanged){
                this._zoomModeChanged.raise();
            }

            if(this.zoomMode == null) {
                return;
            }

            let size = new Size(this.container.width(), this.container.height());
            let img = this.image;

            if(!img){
                return;
            }
            let can = new Element<HTMLDivElement>(this.canvas);
            let imgSize = new Size(img.naturalWidth, img.naturalHeight);
            this._zoom = 1;

            can.removeClass('centered-x');
            can.removeClass('centered-y');
            can.style.marginTop = '';
            can.style.marginLeft = '';

            switch(this.zoomMode){
                case ImageZoomMode.ACTUAL_SIZE:
                    can.width = img.naturalWidth;
                    can.height = img.naturalHeight;
                    this.lblZoom.text = strings.actualSize;
                    break;

                case ImageZoomMode.FIT:
                    let fitted = imgSize.scaleToFit(size);
                    can.width = fitted.width;
                    can.height = fitted.height;
                    this._zoom = fitted.area / imgSize.area;
                    this.lblZoom.text = sprintf("%s%", Math.round(this.zoom * 100));
                    break;
            }

            img.width = can.width;
            img.height = can.height;

            if(size.width > img.width) {
                can.addClass('centered-x');
                can.style.marginLeft = sprintf('%spx', Math.round(-img.width / 2));
            }

            if(size.height > img.height) {
                can.addClass('centered-y');
                can.style.marginTop = sprintf('%spx', Math.round(-img.height / 2));
            }

            if(!size.contains(imgSize)) {
                this.container.css('overflow', 'auto');
            }

            if(this._cropper) {
                // Force update of cropper
                this.onCropBoundsChanged();
            }
        }

        /**
         * Rotates the image counter clockwise
         */
        rotateImageCounterClockwise(){
            this.image = ImageUtil.rotateCounterClockwise(this.image);
            this.unsavedChanges = true;
        }

        /**
         * Rotates the image clockwise
         */
        rotateImageClockwise(){
            this.image = ImageUtil.rotateClockwise(this.image);
            this.unsavedChanges = true;
        }

        //endregion

        //region Events

        /**
         * Back field for event
         */
        private _closed: LatteEvent;

        /**
         * Gets an event raised when the editor has been closed
         *
         * @returns {LatteEvent}
         */
        get closed(): LatteEvent{
            if(!this._closed){
                this._closed = new LatteEvent(this);
            }
            return this._closed;
        }

        /**
         * Back field for event
         */
        private _closeRequested: LatteEvent;

        /**
         * Gets an event raised when the close of editor has been requested
         *
         * @returns {LatteEvent}
         */
        get closeRequested(): LatteEvent{
            if(!this._closeRequested){
                this._closeRequested = new LatteEvent(this);
            }
            return this._closeRequested;
        }

        /**
         * Back field for event
         */
        private _cropBoundsChanged: LatteEvent;

        /**
         * Gets an event raised when the value of the cropBounds property changes
         *
         * @returns {LatteEvent}
         */
        get cropBoundsChanged(): LatteEvent{
            if(!this._cropBoundsChanged){
                this._cropBoundsChanged = new LatteEvent(this);
            }
            return this._cropBoundsChanged;
        }

        /**
         * Back field for event
         */
        private _editableChanged: LatteEvent;

        /**
         * Gets an event raised when the value of the editable property changes
         *
         * @returns {LatteEvent}
         */
        get editableChanged(): LatteEvent{
            if(!this._editableChanged){
                this._editableChanged = new LatteEvent(this);
            }
            return this._editableChanged;
        }

        /**
         * Back field for event
         */
        private _imageChanged: LatteEvent;

        /**
         * Gets an event raised when the value of the image property changes
         *
         * @returns {LatteEvent}
         */
        get imageChanged(): LatteEvent{
            if(!this._imageChanged){
                this._imageChanged = new LatteEvent(this);
            }
            return this._imageChanged;
        }

        /**
         * Back field for event
         */
        private _mouseCropAreaChanged: LatteEvent;

        /**
         * Gets an event raised when the value of the mouseCropArea property changes
         *
         * @returns {LatteEvent}
         */
        get mouseCropAreaChanged(): LatteEvent{
            if(!this._mouseCropAreaChanged){
                this._mouseCropAreaChanged = new LatteEvent(this);
            }
            return this._mouseCropAreaChanged;
        }

        /**
         * Back field for event
         */
        private _saved: LatteEvent;

        /**
         * Gets an event raised when the image is saved
         *
         * @returns {LatteEvent}
         */
        get saved(): LatteEvent{
            if(!this._saved){
                this._saved = new LatteEvent(this);
            }
            return this._saved;
        }

        /**
         * Back field for event
         */
        private _saveRequested: LatteEvent;

        /**
         * Gets an event raised when the save has been requested
         *
         * @returns {LatteEvent}
         */
        get saveRequested(): LatteEvent{
            if(!this._saveRequested){
                this._saveRequested = new LatteEvent(this);
            }
            return this._saveRequested;
        }

        /**
         * Back field for event
         */
        private _toolChanged: LatteEvent;

        /**
         * Gets an event raised when the value of the tool property changes
         *
         * @returns {LatteEvent}
         */
        get toolChanged(): LatteEvent{
            if(!this._toolChanged){
                this._toolChanged = new LatteEvent(this);
            }
            return this._toolChanged;
        }

        /**
         * Back field for event
         */
        private _zoomModeChanged: LatteEvent;

        /**
         * Gets an event raised when the value of the zoomMode property changes
         *
         * @returns {LatteEvent}
         */
        get zoomModeChanged(): LatteEvent{
            if(!this._zoomModeChanged){
                this._zoomModeChanged = new LatteEvent(this);
            }
            return this._zoomModeChanged;
        }

        //endregion

        //region Properties

        /**
         * Property field
         */
        private _cropBounds: ICropBounds = null;

        /**
         * Gets or sets the crop bounds
         *
         * @returns {ICropBounds}
         */
        get cropBounds(): ICropBounds{
            return this._cropBounds;
        }

        /**
         * Gets or sets the crop bounds
         *
         * @param {ICropBounds} value
         */
        set cropBounds(value: ICropBounds){

            // Check if value changed
            let changed: boolean = value !== this._cropBounds;

            // Set value
            this._cropBounds = value;

            // Trigger changed event
            if(changed){
                this.onCropBoundsChanged();
            }
        }

        /**
         * Property field
         */
        private _editable: boolean = true;

        /**
         * Gets or sets a value indicating if the image should be editable
         *
         * @returns {boolean}
         */
        get editable(): boolean{
            return this._editable;
        }

        /**
         * Gets or sets a value indicating if the image should be editable
         *
         * @param {boolean} value
         */
        set editable(value: boolean){

            // Check if value changed
            let changed: boolean = value !== this._editable;

            // Set value
            this._editable = value;

            // Trigger changed event
            if(changed){
                this.onEditableChanged();
            }
        }

        /**
         * Property field
         */
        private _image: HTMLImageElement = null;

        /**
         * Gets or sets the image of the editor
         *
         * @returns {HTMLImageElement}
         */
        get image(): HTMLImageElement{
            return this._image;
        }

        /**
         * Gets or sets the image of the editor
         *
         * @param {HTMLImageElement} value
         */
        set image(value: HTMLImageElement){

            // Check if value changed
            let changed: boolean = value !== this._image;

            // Set value
            this._image = value;

            // Trigger changed event
            if(changed){
                this.onImageChanged();
            }
        }

        /**
         * Property field
         */
        private _mouseCropArea: CropArea = null;

        /**
         * Gets or sets the CropArea of current mouse position
         *
         * @returns {CropArea}
         */
        get mouseCropArea(): CropArea{
            return this._mouseCropArea;
        }

        /**
         * Gets or sets the CropArea of current mouse position
         *
         * @param {CropArea} value
         */
        set mouseCropArea(value: CropArea){

            // Check if value changed
            let changed: boolean = value !== this._mouseCropArea;

            // Set value
            this._mouseCropArea = value;

            // Trigger changed event
            if(changed){
                this.onMouseCropAreaChanged();
            }
        }

        /**
         * Property field
         */
        private _tool: ImageEditorTool = ImageEditorTool.NONE;

        /**
         * Gets or sets the current tool of the editor
         *
         * @returns {ImageEditorTool}
         */
        get tool(): ImageEditorTool{
            return this._tool;
        }

        /**
         * Gets or sets the current tool of the editor
         *
         * @param {ImageEditorTool} value
         */
        set tool(value: ImageEditorTool){

            // Check if value changed
            let changed: boolean = value !== this._tool;

            // Set value
            this._tool = value;

            // Trigger changed event
            if(changed){
                this.onToolChanged();
            }
        }

        /**
         * Property field
         */
        private _zoom: number;

        /**
         * Gets the current zoom level. (1 is 100%)
         *
         * @returns {number}
         */
        get zoom(): number {
            return this._zoom;
        }

        /**
         * Property field
         */
        private _zoomMode: ImageZoomMode = null;

        /**
         * Gets or sets the image zoom mode
         *
         * @returns {ImageZoomMode}
         */
        get zoomMode(): ImageZoomMode{
            return this._zoomMode;
        }

        /**
         * Gets or sets the image zoom mode
         *
         * @param {ImageZoomMode} value
         */
        set zoomMode(value: ImageZoomMode){

            // Check if value changed
            let changed: boolean = value !== this._zoomMode;

            // Set value
            this._zoomMode = value;

            // Trigger changed event
            if(changed){
                this.onZoomModeChanged();
            }
        }

        //endregion

        //region Components

        /**
         * Field for btnClose property
         */
        private _btnClose: ButtonItem;

        /**
         * Gets the close button
         *
         * @returns {ButtonItem}
         */
        get btnClose(): ButtonItem {
            if (!this._btnClose) {
                this._btnClose = new ButtonItem(null, LinearIcon.cross, () => this.closeClick());
            }
            return this._btnClose;
        }

        /**
         * Field for btnCrop property
         */
        private _btnCrop: ButtonItem;

        /**
         * Gets the crop button
         *
         * @returns {ButtonItem}
         */
        get btnCrop(): ButtonItem {
            if (!this._btnCrop) {
                this._btnCrop = new ButtonItem(null, LinearIcon.crop, () => this.tool = ImageEditorTool.CROP);
            }
            return this._btnCrop;
        }

        /**
         * Field for cropNow property
         */
        private _btnCropNow: ButtonItem;

        /**
         * Gets the crop now button
         *
         * @returns {ButtonItem}
         */
        get btnCropNow(): ButtonItem {
            if (!this._btnCropNow) {
                this._btnCropNow = new ButtonItem(strings.cropNow, null, () => this.cropNow());
                this._btnCropNow.visible = false;
            }
            return this._btnCropNow;
        }

        /**
         * Field for btnRotateClockwise property
         */
        private _btnRotateClockwise: ButtonItem;

        /**
         * Gets the rotate clockwise button
         *
         * @returns {ButtonItem}
         */
        get btnRotateClockwise(): ButtonItem {
            if (!this._btnRotateClockwise) {
                this._btnRotateClockwise = new ButtonItem(null, LinearIcon.redo, () => this.rotateImageClockwise());
            }
            return this._btnRotateClockwise;
        }

        /**
         * Field for btnRotateCounterClockwise property
         */
        private _btnRotateCounterClockwise: ButtonItem;

        /**
         * Gets the rotate counter clockwise button
         *
         * @returns {ButtonItem}
         */
        get btnRotateCounterClockwise(): ButtonItem {
            if (!this._btnRotateCounterClockwise) {
                this._btnRotateCounterClockwise = new ButtonItem(null, LinearIcon.undo, () => this.rotateImageCounterClockwise());
            }
            return this._btnRotateCounterClockwise;
        }

        /**
         * Field for btnSave property
         */
        private _btnSave: ButtonItem;

        /**
         * Gets the save button
         *
         * @returns {ButtonItem}
         */
        get btnSave(): ButtonItem {
            if (!this._btnSave) {
                this._btnSave = new ButtonItem(null, LinearIcon.download, () => this.onSaveRequested());
                this._btnSave.enabled = false;
            }
            return this._btnSave;
        }

        /**
         * Field for canvas property
         */
        private _canvas: HTMLDivElement;

        /**
         * Gets the canvas where image is placed
         *
         * @returns {HTMLCanvasElement}
         */
        get canvas(): HTMLDivElement {
            if (!this._canvas) {
                this._canvas = document.createElement('div');
                this._canvas.className = 'canvas';
            }
            return this._canvas;
        }

        /**
         * Field for cropper property
         */
        private _cropper: Element<HTMLDivElement>;

        /**
         * Gets the cropper element
         *
         * @returns {Element<HTMLDivElement>}
         */
        get cropper(): Element<HTMLDivElement> {
            if (!this._cropper) {
                this._cropper = new Element<HTMLDivElement>(document.createElement('div'));
                this._cropper.addClass('cropper');
            }
            return this._cropper;
        }

        /**
         * Field for copperOverlayTop property
         */
        private _cropperOverlayTop: HTMLDivElement;

        /**
         * Gets the cropper overlay top
         *
         * @returns {HTMLDivElement}
         */
        get cropperOverlayTop(): HTMLDivElement {
            if (!this._cropperOverlayTop) {
                this._cropperOverlayTop = document.createElement('div');
                this._cropperOverlayTop.className = 'cropper-overlay top';
            }
            return this._cropperOverlayTop;
        }

        /**
         * Field for copperOverlayTop property
         */
        private _cropperOverlayLeft: HTMLDivElement;

        /**
         * Gets the cropper overlay top
         *
         * @returns {HTMLDivElement}
         */
        get cropperOverlayLeft(): HTMLDivElement {
            if (!this._cropperOverlayLeft) {
                this._cropperOverlayLeft = document.createElement('div');
                this._cropperOverlayLeft.className = 'cropper-overlay left';
            }
            return this._cropperOverlayLeft;
        }

        /**
         * Field for copperOverlayTop property
         */
        private _cropperOverlayRight: HTMLDivElement;

        /**
         * Gets the cropper overlay top
         *
         * @returns {HTMLDivElement}
         */
        get cropperOverlayRight(): HTMLDivElement {
            if (!this._cropperOverlayRight) {
                this._cropperOverlayRight = document.createElement('div');
                this._cropperOverlayRight.className = 'cropper-overlay right';
            }
            return this._cropperOverlayRight;
        }

        /**
         * Field for copperOverlayTop property
         */
        private _cropperOverlayBottom: HTMLDivElement;

        /**
         * Gets the cropper overlay top
         *
         * @returns {HTMLDivElement}
         */
        get cropperOverlayBottom(): HTMLDivElement {
            if (!this._cropperOverlayBottom) {
                this._cropperOverlayBottom = document.createElement('div');
                this._cropperOverlayBottom.className = 'cropper-overlay bottom';
            }
            return this._cropperOverlayBottom;
        }


        /**
         * Field for lblZoom property
         */
        private _lblZoom: LabelItem;

        /**
         * Gets the zoom label
         *
         * @returns {LabelItem}
         */
        get lblZoom(): LabelItem {
            if (!this._lblZoom) {
                this._lblZoom = new LabelItem();
            }
            return this._lblZoom;
        }

        /**
         * Field for progressItem property
         */
        private _progressItem: ProgressItem;

        /**
         * Gets the progress item
         *
         * @returns {ProgressItem}
         */
        get progressItem(): ProgressItem {
            if (!this._progressItem) {
                this._progressItem = new ProgressItem();
                this._progressItem.animated = false;
                this._progressItem.element.css('min-width', 100);
                this._progressItem.element.css('max-width', 100);
            }
            return this._progressItem;
        }


        //endregion

    }

}