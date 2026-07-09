// Place holder for presentation data models and business logic 
// to be cleanly separated from UI and Store.
export class PresentationModel {
    constructor(id, title, sections = []) {
        this.id = id;
        this.title = title;
        this.sections = sections;
    }
}
