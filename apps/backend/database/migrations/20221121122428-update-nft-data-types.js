/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('nfts', 'uri', {
            type: Sequelize.TEXT,
            allowNull: true,
        })
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.changeColumn('nfts', 'uri', {
            type: Sequelize.BLOB,
            allowNull: true,
        })
    },
};
