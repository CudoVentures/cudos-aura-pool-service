import { 
    Get,
    Param,
    Controller 
} from '@nestjs/common';
import { GraphqlService } from '../graphql/graphql.service';
import { TransferHistoryEntry } from './dto/transfer-history.dto';

@Controller('statistics')
export class StatisticsController {
    constructor(
        private graphqlService: GraphqlService,
    ) {}

        
    @Get('history/nft/:uid')
    async getTransferHistory(@Param('uid') uid: string): Promise<TransferHistoryEntry[]> {
        // TODO: Get tokenId and denomId via uid
        const tokenId = 1;
        const denomId = "testdenom";

        const nftTransferHistory = await this.graphqlService.fetchNftTransferHistory(tokenId, denomId);
        const nftTradeHistory = await this.graphqlService.fetchMarketplaceNftTradeHistory(tokenId, denomId);

        let history: TransferHistoryEntry[] = [];
    
        nftTransferHistory.forEach((transfer) => {
            let eventType = 'transfer';
            if (transfer.old_owner == '0x0') {
                eventType = 'mint';
            }

            history.push({
                from: transfer.old_owner,
                to: transfer.new_owner,
                timestamp: transfer.timestamp,
                eventType: eventType
            });
        });

        nftTradeHistory.forEach((trade) => {
            let eventType = 'sale';
            if (trade.seller = '0x0') {
                eventType = 'mint';
            }

            history.push({
                from: trade.seller,
                to: trade.buyer,
                timestamp: trade.timestamp,
                btcPrice: trade.btc_price,
                usdPrice: trade.usd_price,
                eventType: eventType
            });
        });

        history.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : -1)

        return history;
    }
}
