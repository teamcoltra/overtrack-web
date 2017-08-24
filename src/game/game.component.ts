import { Component, OnInit, Input, Inject } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { DOCUMENT } from '@angular/platform-browser';
import { Http, RequestOptions, Headers, Response } from '@angular/http';
import 'rxjs/add/operator/switchMap';
import * as D3 from 'd3';
import { GameService, Game, KillFeedEntry, Stage, GameHero, GameEvent} from './game.service';
import { UserLoginService, User } from '../login/user-login.service';

declare var $: any;

@Component({
    selector: 'metagame',
    templateUrl: './metagame.component.html'
})
export class MetaGameComponent  implements OnInit {
    @Input() id: string;
    data: any;
    hide: boolean;
    
    constructor(
        private gameService: GameService
    ) {}
    
    ngOnInit(): void {
        this.hide = true;
        this.gameService.getMetaGame(this.id).subscribe(
                res => {
                    const body = res.json();
                    this.data = body;
                },
                err => {
                    console.error(err);
                }
            );
    }
     
     toggleMeta() {
         this.hide = !this.hide;
     }
      
     keys(obj: any, remove: Array<string>) {
         if (obj) {
            return Object.keys(obj).filter((a) => !remove.includes(a));
         }
         return [];
     }
}

@Component({
    selector: 'game',
    templateUrl: './game.component.html',
    providers: [GameService]
})
export class GameComponent implements OnInit {
    game: Game;
    hideTimelineKey: boolean;

    private editURL = 'https://api.overtrack.gg/edit_game';

    user: User;

    constructor(
        public gameService: GameService, 
        public route: ActivatedRoute, 
        public loginService: UserLoginService,
        private http: Http,
        @Inject(DOCUMENT) public document: any
    ) { }

    ngOnInit(): void {
        this.hideTimelineKey = true;
        this.route.params
            .switchMap((params: Params) =>
                       this.gameService.getGame(params['user'] + '/' + params['game']))
            .subscribe(
                res => {
                    this.game = this.gameService.toGame(res);
                },
                err => {
                    console.error(err);
                }
            );
        this.loginService.fetchUser(user => {
            this.user = user;
        })
    }
    
    toggleTimelineKey() {
        this.hideTimelineKey = !this.hideTimelineKey;
    }

    normaliseString(str: string){
        return str.toLowerCase().replace(/\s/g, '_').replace(/\W/g, '').replace(/_/g, '-');
    }

    stageHref(stage: Stage){
        return 'stage_' + stage.index;
    }

    mapClass() {
        if (this.game === null) {
            return '';
        }
        return this.normaliseString(this.game.map);
    }
    
    wltClass() {
        if (this.game.result == 'UNKN' || !this.game.result){
            return 'text-unknown';
        } else if (this.game.result == 'DRAW'){
            return 'text-warning';
        } else if (this.game.result == 'WIN'){
            return 'text-success';
        } else if (this.game.result == 'LOSS'){
            return 'text-danger';
        }
        throw new Error('Unexpected game result: ' + this.game.result);
    }
    
    displaySR(sr: number) {
        if (sr === null || sr == undefined) {
            return '?';
        }
        return '' + sr;
    }
    
    displayGameTime() {
        const time = this.game.duration;
        const min = D3.format('d')(Math.floor(time / 60));
        const sec = D3.format('02')(time - (Math.floor(time / 60) * 60));
        return min + ':' + sec;
    }
    
    displaySRChange() {
        if (this.game.startSR === null || this.game.startSR == undefined 
           || this.game.endSR === null || this.game.endSR == undefined) {
            return '?';
        }
        const diff = this.game.endSR - this.game.startSR;
        return diff > 0 ? '+' + diff : '' + diff;
    }
    
    rank(sr: number) {
        if (sr === null || sr == undefined) {
            return 'unknown';
        } else if (sr < 1500) {
            return 'bronze';
        } else if (sr < 2000) {
            return 'silver';
        } else if (sr < 2500) {
            return 'gold';
        } else if (sr < 3000) {
            return 'platinum';
        } else if (sr < 3500) {
            return 'diamond';
        } else if (sr < 4000) {
            return 'master';
        } else {
            return 'grandmaster';
        }
    }

    formatTime(date: Date) {
        let hour = date.getHours();
        const pm = hour > 11;
        hour = hour % 12;
        hour = hour === 0 ? 12 : hour;
        let min: number|string = date.getMinutes();
        if (min < 10){
            min = '0' + min;
        }
        return hour + ':' + min + (pm ? 'pm' : 'am');
    }

    formatDate(date: Date) {
        return date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear().toString().slice(2);
    }

    formatDay(date: Date) {
        var days = ['Sun','Mon','Tues','Wed','Thurs','Fri','Sat'];
        return days[date.getDay()]
    }

    edit() {
        // this should not be jquery...
        let playername = $('#playername-input').val();
        let startSR = Number($('#start-sr-input').val());
        let endSR = Number($('#end-sr-input').val());
        let placement = $('#is-placement-input').get(0).checked;

        if (playername != this.game.player){
            if (!confirm('Changing the player name will change the tab this game belongs to in the games list. Are you sure?')){
                console.log('Edit canceled');
                $('#edit').modal('hide');
                return;
            }
        }

        this.game.player = playername;
        if (this.game.teams){
            this.game.teams.blue[0].name = playername;
        }

        if (this.game.startSR != startSR){
            this.game.startSREditable = true;
        }
        this.game.startSR = startSR || null;

        if (this.game.endSR != endSR){
            this.game.endSREditable = true;
        }
        this.game.endSR = endSR || null;

        this.game.placement = placement;

        let headers = new Headers({ 'Content-Type': 'application/json' });
        let options = new RequestOptions({ headers: headers, withCredentials: true });
        this.http.post(
            this.editURL, 
            {
                'game': this.game.key,
                'player_name': playername,
                'start_sr': startSR,
                'end_sr': endSR,
                'placement': placement
            },
            options
        ).subscribe(
            succ => {
                $('#edit').modal('hide');
            },
            err => {
                $('#edit').modal('hide');
                throw err;
            }
        );
    }

    delete() {
        if (!confirm('Deleting a game cannot be undone. Are you sure?')){
            console.log('Delete canceled');
            $('#edit').modal('hide');
            return;
        }

        let headers = new Headers({ 'Content-Type': 'application/json' });
        let options = new RequestOptions({ headers: headers, withCredentials: true });
        this.http.post(
            this.editURL, 
            {
                'game': this.game.key,
                'delete': true
            },
            options
        ).subscribe(
            succ => {
                this.document.location.href = '/';
            },
            err => {
                $('#edit').modal('hide');
                throw err;
            }
        );
    }
}
