import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

type TableRow={player:string;played:number;wins:number;draws:number;losses:number;points:number};
type Fixture={matchday:number;homePlayer:string;awayPlayer:string;homePoints:number|null;awayPoints:number|null};

@Component({
  selector:'app-root', standalone:true, imports:[CommonModule],
  template:`<main><header><p class="eyebrow">KICKBASE ENGELTHAL</p><h1>Head to Head</h1><p>Saison 26/27</p></header>
  <section class="toolbar"><label>Spieltag <select (change)="selectDay($any($event.target).value)">@for (day of days; track day) {<option [value]="day" [selected]="day===matchday">{{day}}</option>}</select></label></section>
  <div class="grid"><section class="card"><h2>Tabelle</h2><table><thead><tr><th>#</th><th>Spieler</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Pkt</th></tr></thead><tbody>@for(row of table; track row.player; let i=$index){<tr><td>{{i+1}}</td><td>{{row.player}}</td><td>{{row.played}}</td><td>{{row.wins}}</td><td>{{row.draws}}</td><td>{{row.losses}}</td><td class="points">{{row.points}}</td></tr>}</tbody></table></section>
  <section class="card"><h2>Duelle · Spieltag {{matchday}}</h2><div class="fixtures">@for(fixture of fixtures; track fixture.homePlayer){<article><span>{{fixture.homePlayer}}</span><strong>{{fixture.homePoints ?? '–'}} : {{fixture.awayPoints ?? '–'}}</strong><span>{{fixture.awayPlayer}}</span></article>}</div><p class="hint">Wird nach dem Punktimport am Dienstag aktualisiert.</p></section></div></main>`
})
export class AppComponent {
  private http=inject(HttpClient); days=Array.from({length:34},(_,i)=>i+1); matchday=1; table:TableRow[]=[]; fixtures:Fixture[]=[];
  constructor(){this.load();}
  selectDay(day:string){this.matchday=Number(day);this.loadFixtures();}
  private load(){this.http.get<TableRow[]>('/api/table').subscribe(v=>this.table=v);this.loadFixtures();}
  private loadFixtures(){this.http.get<Fixture[]>(`/api/matchdays/${this.matchday}`).subscribe(v=>this.fixtures=v);}
}
