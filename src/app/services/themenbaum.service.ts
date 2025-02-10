import { Injectable } from '@angular/core';
import { DISCIPLINE_MAPPING, EDUCATIONAL_CONTEXT_MAPPING, TARGET_GROUP_MAPPING } from './mappings';

export interface ThemenbaumRequest {
  thema: string;
  hauptkategorien: number;
  unterkategorien: number;
  weitereUnterkategorien: number;
  bildungsstufen: string[];
  fachgebiete: string[];
  zielgruppen: string[];
}

interface MappedThemenbaumRequest {
  thema: string;
  hauptkategorien: number;
  unterkategorien: number;
  weitereUnterkategorien: number;
  "ccm:educationalcontext": string[];
  "ccm:taxonid": string[];
  "ccm:educationalintendedenduserrole": string[];
}

@Injectable({
  providedIn: 'root'
})
export class ThemenbaumService {
  private readonly apiUrl = 'https://api.beispiel.de/themenbaumgenerierung';

  private mapValues(request: ThemenbaumRequest): MappedThemenbaumRequest {
    return {
      thema: request.thema,
      hauptkategorien: request.hauptkategorien,
      unterkategorien: request.unterkategorien,
      weitereUnterkategorien: request.weitereUnterkategorien,
      "ccm:educationalcontext": request.bildungsstufen.map(stufe => 
        EDUCATIONAL_CONTEXT_MAPPING[stufe] || stufe
      ).filter(uri => uri !== ""),
      "ccm:taxonid": request.fachgebiete.map(fach => 
        DISCIPLINE_MAPPING[fach] || fach
      ).filter(uri => uri !== ""),
      "ccm:educationalintendedenduserrole": request.zielgruppen.map(gruppe => 
        TARGET_GROUP_MAPPING[gruppe] || gruppe
      ).filter(uri => uri !== "")
    };
  }

  generateCurlCommand(request: ThemenbaumRequest): string {
    const mappedRequest = this.mapValues(request);
    const jsonData = JSON.stringify(mappedRequest, null, 2);
    return `curl -X POST ${this.apiUrl} \\
     -H "Content-Type: application/json" \\
     -d '${jsonData}'`;
  }
}
