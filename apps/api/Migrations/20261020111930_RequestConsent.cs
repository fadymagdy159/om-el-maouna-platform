using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OmElMaouna.Api.Migrations
{
    /// <inheritdoc />
    public partial class RequestConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ConsentGiven",
                table: "ServiceRequests",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConsentGiven",
                table: "ServiceRequests");
        }
    }
}
